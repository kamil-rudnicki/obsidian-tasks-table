// An error whose message is written for people, so the UI can show it as is.
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}
