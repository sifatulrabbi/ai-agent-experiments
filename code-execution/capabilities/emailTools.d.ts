declare module "emailTools" {
  export type EmailObject = {
    subject: string;
    body: {
      /** The HTML format Email content. */
      html?: string;
      /** The text version of the Email content in case the email client can't render HTML. */
      text: string;
    };
    to: string[];
    cc: string[];
    bcc: string[];
  };

  export type EmailObjectRecord = EmailObject & {
    id: string;
    sentAt: string;
    createdAt: string;
  };

  /**
   * Get emails of the current user you are assisting.
   * @returns An array of EmailObjectRecord
   * @throws If the fetching of the email fails then it will throw an `Error`.
   */
  export function getEmails(): Promise<EmailObjectRecord[]>;

  /**
   * Send an email on behalf of the user you are assisting.
   * @param {EmailObject} emailObj - An EmailObject
   * @returns A EmailObjectRecord upon sending the email to the recipients
   * @throws If sending of the email fails after the 3rd try it will throw an `Error`.
   */
  export function sendEmail(emailObj: EmailObject): Promise<EmailObjectRecord>;
}
