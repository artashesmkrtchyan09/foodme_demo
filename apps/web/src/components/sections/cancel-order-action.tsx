import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { foodmeApi } from "@/api/foodme";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CancelOrderActionProps {
  number: string;
  status: string;
  className?: string;
}

function cancelErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    // The backend answers 404 for orders that belong to someone else.
    if (error.status === 404) return "Only the customer who placed this order can cancel it.";
    return error.message;
  }
  return "Couldn’t cancel the order. Please try again.";
}

/**
 * "Cancel order" button with a confirmation dialog, shown while the order is
 * still NEW. If the cancel fails (e.g. the kitchen accepted it a moment ago),
 * the reason stays visible and the order queries refetch to show the real status.
 */
export function CancelOrderAction({ number, status, className }: CancelOrderActionProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => foodmeApi.cancelOrder(number),
    onMutate: () => setError(null),
    onError: (err) => setError(cancelErrorMessage(err)),
    onSettled: () => {
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order", number] });
    },
  });

  const cancellable = status === "NEW";
  if (!cancellable && !error) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {cancellable && (
        <Button
          variant="outline"
          size="sm"
          className="border-red-200 text-red-700 hover:bg-red-50"
          disabled={mutation.isPending}
          onClick={() => setOpen(true)}
        >
          Cancel order
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <Dialog open={open} onOpenChange={(next) => !mutation.isPending && setOpen(next)}>
        <DialogContent className="p-6">
          <DialogTitle className="pr-10 text-lg font-bold text-zinc-900">
            Cancel order {number}?
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-zinc-500">
            This can't be undone.
          </DialogDescription>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" disabled={mutation.isPending}>
                Keep order
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Cancelling…" : "Cancel order"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
