import { prisma } from "@/lib/db";
import { verifyFileLink } from "@/lib/mcp/file-link";
import { getFileBuffer } from "@/lib/invoice-send";
import { htmlToPdf } from "@/lib/html-to-pdf";

// Serves an invoice file for a signed, short-lived MCP download link (no session;
// the HMAC token binds the invoice id + owner + expiry).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(req.url).searchParams.get("t");
  if (!token) return new Response("missing token", { status: 401 });

  const v = verifyFileLink(token);
  if (!v || v.invoiceId !== id) return new Response("invalid or expired token", { status: 401 });

  const inv = await prisma.invoice.findFirst({
    where: { id, userId: v.userId },
    select: { fileName: true, filePath: true, fileUrl: true, fileData: true },
  });
  if (!inv) return new Response("not found", { status: 404 });

  try {
    let buffer = await getFileBuffer(inv);
    let contentType = "application/pdf";
    let name = inv.fileName;
    const isHtml = inv.fileName.endsWith(".html") || inv.filePath === "inline-html";
    const isImage = /\.(jpg|jpeg|png|webp)$/i.test(inv.fileName);
    if (isHtml) {
      buffer = await htmlToPdf(buffer.toString("utf-8"));
      name = name.replace(/\.html$/i, ".pdf");
    } else if (isImage) {
      contentType = "image/png";
    }
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("mcp file download error:", e);
    return new Response("file error", { status: 500 });
  }
}
