import { z } from "zod";

// Mirrors OrderReviewRequestDto on the backend: whole stars 1–5, comment up to 1000 characters.
export const orderReviewSchema = z.object({
  stars: z
    .number({ error: "Choose a rating" })
    .int("Choose a rating")
    .min(1, "Choose a rating")
    .max(5, "Choose a rating"),
  comment: z.string().max(1000, "Comment must be at most 1000 characters"),
});

export type OrderReviewFormValues = z.infer<typeof orderReviewSchema>;
