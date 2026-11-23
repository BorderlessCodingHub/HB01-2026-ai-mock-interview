import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getErrorMessage } from "@/components/app/app-error-state";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // A first load that fails has no data, and its page renders an inline
      // error with a retry button. Toast only when a background refetch fails
      // while stale data is still on screen, so errors aren't shown twice.
      if (query.state.data === undefined) return;

      toast.error(getErrorMessage(error, "Couldn't refresh the latest data."), {
        action: {
          label: "Retry",
          onClick: () => {
            void query.invalidate();
          },
        },
      });
    },
  }),
});
