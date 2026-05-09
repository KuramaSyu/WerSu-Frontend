export class UserError extends Error {
  readonly title: string;
  readonly description: string;
  readonly status: number;

  constructor(title: string, description: string, status: number) {
    super(description);
    this.name = "UserError";
    this.title = title;
    this.status = status;
    this.description = description;
  }
}
