import { Box } from "ink";
import type { PropsWithChildren, ReactElement } from "react";

export function SplitLayout({ children }: PropsWithChildren): ReactElement {
  return (
    <Box
      flexDirection="row"
      flexGrow={1}
      borderStyle="round"
      borderColor="gray"
    >
      {children}
    </Box>
  );
}
