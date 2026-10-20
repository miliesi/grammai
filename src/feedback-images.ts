// Redraw selected images locally so filenames and embedded metadata are not
// uploaded. Nothing is captured from the screen or uploaded during selection.
export async function prepareScreenshot(file: File): Promise<Blob> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose PNG, JPEG or WebP images.");
  if (file.size > 2 * 1024 * 1024)
    throw new Error("Each image must be 2 MB or smaller.");
  const image = await createImageBitmap(file);
  try {
    if (image.width * image.height > 16000000)
      throw new Error("Please crop or resize this image before attaching it.");
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob || blob.size > 2 * 1024 * 1024)
      throw new Error("Please crop or resize this image before attaching it.");
    return blob;
  } finally {
    image.close();
  }
}
