"use client";

interface ThreadErrorAlertProps {
  message: string;
}

export function ThreadErrorAlert({ message }: ThreadErrorAlertProps) {
  return (
    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-sm">
      {message}
    </div>
  );
}
