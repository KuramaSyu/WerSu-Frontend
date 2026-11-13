/**
 * Poll an image URL as long as it returns 403 or 401 until it becomes
 * accessible (200). Attachment permission tuples are written
 * asynchronously after the upload is linked, so the image can 401/403
 * for the first few requests even though the upload itself succeeded.
 *
 * Shared by the editor's image paste/drop flow and the image upload
 * modal (note headers / directory images).
 *
 * @param url absolute image URL to poll
 * @returns the successful (GET) response, or null if the retry budget
 *   is exhausted
 */
export async function waitForImagePermission(
  url: string,
): Promise<Response | null> {
  // Don't wait a static amount. 833, 714, 625, 555, 500, 454, 416,
  // 384, 357, 333, 312, 294, 277, 263, 250, 238, 227, 217, 208 ms...
  // -- carefully crafted backoff.
  const getWaitSeconds = (attempt: number) =>
    Math.max(1000 / (1 + attempt - attempt * 0.8), 500);

  const maxLoops = 50;
  for (let i = 1; i <= maxLoops; i++) {
    console.log(
      `Checking image permission, attempt ${i}/${maxLoops}, wait ${getWaitSeconds(i)}ms before try...`,
    );
    await new Promise((resolve) => setTimeout(resolve, getWaitSeconds(i))); // wait before retrying

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 200) {
      return response;
    } else if (!(response.status === 403 || response.status === 401)) {
      throw new Error(
        `Failed while waiting for image: ${response.statusText}; code: ${response.status}`,
      );
    }
  }
  return null;
}
