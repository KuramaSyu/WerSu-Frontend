import type { Editor } from "@tiptap/core";
import { SnackbarUpdateImpl } from "../../zustand/InfoStore";
import { AttachmentApi, type IAttachmentApi } from "../../api/AttachmentApi";
import type { AttachmentMetadata } from "../../api/models/attachment";
import { de } from "zod/v4/locales";
import { queryClient } from "../../api/queryClient";
import { AttachmentLinkBuilder } from "../../api/utils/AttachmentLInkBuilder";

class UploadFileBuilder {
  private editor: Editor | null = null;
  private file: File | null = null;
  private setErrorMessageMethod: (message: SnackbarUpdateImpl) => void;
  private attachmentsApi: IAttachmentApi;
  private note_id: string | null = null;
  private onUploadSuccess: ((attachment: AttachmentMetadata) => void) | null =
    null;

  /**method which takes the link as input and injects this link into any editor */
  private insertIntoEditorFunc: ((text: string) => void) | null = null;

  constructor(
    attachmentsApi: IAttachmentApi,
    setErrorMessageMethod: (message: SnackbarUpdateImpl) => void,
  ) {
    this.setErrorMessageMethod = setErrorMessageMethod;
    this.attachmentsApi = attachmentsApi;
  }

  setFile(file: File) {
    this.file = file;
    return this;
  }

  /**
   * builder function to put the image into the editor
   * @param insertAtCurrentPosition function, which takes in a string (the image link) and inserts it into the editor, whichever editor is used (tiptap/textbox)
   * @returns
   */
  insertIntoEditor(insertAtCurrentPosition: (text: string) => void) {
    this.insertIntoEditorFunc = insertAtCurrentPosition;
    return this;
  }

  linkToNote(note_id: string) {
    this.note_id = note_id;
    return this;
  }

  insertOnUploadSuccessHook(
    onUploadSuccess: (attachment: AttachmentMetadata) => void,
  ) {
    this.onUploadSuccess = onUploadSuccess;
    return this;
  }

  /**
   * final method of the builder
   * @returns the attachment key of the uploaded file, or null if upload failed
   */
  async upload(): Promise<string | null> {
    var attachment_key = null;

    if (!this.file) {
      this.setErrorMessageMethod(
        new SnackbarUpdateImpl("No file provided", "error"),
      );
      return attachment_key;
    }
    try {
      // upload attachment and get metadata with key

      const attachmentResponse = await this.attachmentsApi.createAttachment(
        this.file,
      );
      if (!attachmentResponse) {
        this.setErrorMessageMethod(
          new SnackbarUpdateImpl("Failed to create attachment", "error"),
        );
        return attachment_key;
      }
      attachment_key = attachmentResponse.key;

      // now the tanstack query is off. update it
      queryClient.invalidateQueries({
        queryKey: ["attachments", this.note_id],
      });

      // if a note_id was provided, then link note with attachment
      if (this.note_id) {
        const linkResponse = await this.attachmentsApi.linkAttachment({
          attachment_key: attachmentResponse.key,
          note_id: this.note_id,
        });
        if (!linkResponse) {
          this.setErrorMessageMethod(
            new SnackbarUpdateImpl(
              "Failed to create link between attachment and note",
              "error",
            ),
          );
          return attachment_key;
        }
      }

      // run editor insert hook
      if (this.insertIntoEditorFunc) {
        this.insertIntoEditorFunc(
          new AttachmentLinkBuilder(this.attachmentsApi)
            .setWidth(720)
            .getLink(attachment_key),
        );
      }

      // run upload success hook
      if (this.onUploadSuccess) {
        this.onUploadSuccess(attachmentResponse);
      }
    } catch (e) {
      this.setErrorMessageMethod(
        new SnackbarUpdateImpl("Failed to upload file", "error"),
      );
    }
    return attachment_key;
  }
}
export default UploadFileBuilder;
