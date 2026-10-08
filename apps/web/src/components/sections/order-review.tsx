import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Star } from "lucide-react";
import { foodmeApi } from "@/api/foodme";
import { ApiRequestError } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  orderReviewSchema,
  type OrderReviewFormValues,
} from "@/schemas/order-review-schema";
import type { OrderListResponseDto, OrderReviewDto } from "@/types";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function starLabel(value: number) {
  return `${value} ${value === 1 ? "star" : "stars"}`;
}

/** Read-only stars, announced as one image ("Rated 4 out of 5 stars"). */
export function StarRating({
  stars,
  size = 16,
  className,
}: {
  stars: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Rated ${stars} out of 5 stars`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {STAR_VALUES.map((value) => (
        <Star
          key={value}
          size={size}
          aria-hidden="true"
          className={value <= stars ? "text-amber-500" : "text-zinc-300"}
          fill="currentColor"
        />
      ))}
    </span>
  );
}

/** A customer's review of an order: stars, comment and date. */
export function OrderReviewSummary({ review }: { review: OrderReviewDto }) {
  return (
    <div data-testid="order-review" className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <StarRating stars={review.stars} />
        <span className="text-xs text-zinc-500">
          {new Date(review.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>
      {review.comment && (
        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-zinc-700">
          {review.comment}
        </p>
      )}
    </div>
  );
}

/**
 * Star picker built on a radio group: click or tap a star, or use the arrow keys.
 * Screen readers announce "Rating, radio group" and each option as "N stars".
 */
function StarRatingInput({
  value,
  onChange,
  invalid,
}: {
  value: number;
  onChange: (value: number) => void;
  invalid: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value;

  return (
    <RadioGroupPrimitive.Root
      aria-label="Rating"
      aria-invalid={invalid || undefined}
      value={value ? String(value) : ""}
      onValueChange={(next) => onChange(Number(next))}
      orientation="horizontal"
      loop={false}
      className="flex items-center gap-1"
      onPointerLeave={() => setHovered(null)}
    >
      {STAR_VALUES.map((star) => (
        <RadioGroupPrimitive.Item
          key={star}
          value={String(star)}
          aria-label={starLabel(star)}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setHovered(star);
          }}
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full",
            "transition-transform duration-150 active:scale-90",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
          )}
        >
          <Star
            size={30}
            aria-hidden="true"
            strokeWidth={1.5}
            className={star <= shown ? "text-amber-500" : "text-zinc-300"}
            fill={star <= shown ? "currentColor" : "none"}
          />
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

interface RateOrderDialogProps {
  orderNumber: string;
  chefName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RateOrderDialog({ orderNumber, chefName, open, onOpenChange }: RateOrderDialogProps) {
  const queryClient = useQueryClient();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrderReviewFormValues>({
    resolver: zodResolver(orderReviewSchema),
    defaultValues: { stars: 0, comment: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: OrderReviewFormValues) =>
      foodmeApi.reviewOrder(orderNumber, {
        stars: values.stars,
        comment: values.comment.trim() || undefined,
      }),
    onSuccess: (review) => {
      // Show the stars straight away instead of waiting for the refetch below.
      queryClient.setQueriesData<OrderListResponseDto>({ queryKey: ["my-orders"] }, (data) =>
        data && {
          ...data,
          list: data.list.map((order) =>
            order.number === orderNumber ? { ...order, review } : order,
          ),
        },
      );
      onOpenChange(false);
      reset();
      // The order now carries its review, and the chef's average rating changed.
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order", orderNumber] });
      void queryClient.invalidateQueries({ queryKey: ["chefs"] });
      void queryClient.invalidateQueries({ queryKey: ["chef"] });
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next && mutation.isPending) return;
    if (!next) {
      reset();
      mutation.reset();
    }
    onOpenChange(next);
  };

  const serverError =
    mutation.error instanceof ApiRequestError
      ? mutation.error.message
      : mutation.error
        ? "Couldn’t save your rating. Check your connection and try again."
        : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby="rate-order-description" className="p-5 sm:p-6">
        <DialogTitle className="pr-10 text-xl font-extrabold text-zinc-900">
          Rate order {orderNumber}
        </DialogTitle>
        <DialogDescription id="rate-order-description" className="mt-1 text-sm text-zinc-500">
          How was your order from {chefName}?
        </DialogDescription>

        <form
          aria-label="Rate order"
          noValidate
          className="mt-5 space-y-5"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <div>
            <Controller
              control={control}
              name="stars"
              render={({ field }) => (
                <StarRatingInput
                  value={field.value}
                  onChange={field.onChange}
                  invalid={!!errors.stars}
                />
              )}
            />
            {errors.stars && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{errors.stars.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-comment">Comment (optional)</Label>
            <textarea
              id="review-comment"
              rows={4}
              maxLength={1000}
              placeholder="Tell us about your order"
              aria-invalid={!!errors.comment || undefined}
              className={cn(
                "w-full resize-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-base text-zinc-900 sm:text-sm",
                "placeholder:text-zinc-400",
                "hover:border-zinc-300",
                "focus-visible:outline-none focus-visible:border-zinc-400 focus-visible:ring-4 focus-visible:ring-zinc-100",
              )}
              {...register("comment")}
            />
            {errors.comment && (
              <p className="text-xs font-medium text-red-600">{errors.comment.message}</p>
            )}
          </div>

          {serverError && (
            <p
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {serverError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting…" : "Submit rating"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
