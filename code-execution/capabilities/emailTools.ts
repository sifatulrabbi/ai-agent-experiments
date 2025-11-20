import type { EmailObject, EmailObjectRecord } from "emailTools";

/**
 * Get emails of the current user you are assisting.
 * @returns An array of EmailObjectRecord
 * @throws If the fetching of the email fails then it will throw an `Error`.
 */
export async function getEmails(): Promise<EmailObjectRecord[]> {
  try {
    const response = await fetch("/api/emails");

    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }

    const emails: EmailObjectRecord[] = await response.json();
    return emails;
  } catch (error) {
    throw new Error(
      `Error fetching emails: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Send an email on behalf of the user you are assisting.
 * @param {EmailObject} emailObj - An EmailObject
 * @returns A EmailObjectRecord upon sending the email to the recipients
 * @throws If sending of the email fails after the 3rd try it will throw an `Error`.
 */
export async function sendEmail(
  emailObj: EmailObject,
): Promise<EmailObjectRecord> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailObj),
      });

      if (!response.ok) {
        throw new Error(`Failed to send email: ${response.statusText}`);
      }

      const sentEmail: EmailObjectRecord = await response.json();
      return sentEmail;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < 3) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw new Error(
    `Failed to send email after 3 attempts: ${lastError?.message}`,
  );
}
