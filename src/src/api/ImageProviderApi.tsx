export interface ImageProviderApi {
  /**
   * Retrieves the image as a Blob from a given hash. This should be part of the URL when creating an image
   *
   * @param hash the last part of the url - like https://cloud/images/<here-comes-the-hash>.webp
   * @returns the image as a Blob
   */
  getImage: (hash: string) => Promise<Blob>;

  /**
   * Uploads an image and returns the URL where the image can be accessed
   *
   * @param file the file to upload
   * @returns the URL where the image can be accessed
   */
  uploadImage: (file: File) => Promise<string>;

  /**
   * Retrieves a 720p webp preview
   * @param hash the last part of the url - like https://cloud/images/<here-comes-the-hash>.webp
   * @returns the image as a Blob
   */
  getPreview: (hash: string) => Promise<Blob>;
}
