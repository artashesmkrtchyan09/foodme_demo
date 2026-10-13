import { useRecordContext } from 'react-admin';
import { Box, Divider, Rating, Stack, Typography } from '@mui/material';
import { OrderStatus } from '../../constants/OrderStatus.jsx';

const ratingLabel = (stars) => `Rated ${stars} out of 5 stars`;

const formatReviewDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

/** "Customer review" section of the order page. Only delivered orders can be reviewed, so it's hidden otherwise. */
export const CustomerReviewSection = () => {
    const record = useRecordContext();
    if (!record || record.status !== OrderStatus.DELIVERED) return null;

    const { review } = record;

    return (
        <Box component="section" aria-labelledby="customer-review-heading">
            <Divider sx={{ my: 2 }} />
            <Typography
                id="customer-review-heading"
                component="h2"
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 1 }}
            >
                Customer review
            </Typography>
            {review ? (
                <>
                    <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                        <Rating
                            value={review.stars}
                            readOnly
                            getLabelText={ratingLabel}
                        />
                        <Typography variant="body2" color="text.secondary">
                            {formatReviewDate(review.createdAt)}
                        </Typography>
                    </Stack>
                    {review.comment && (
                        <Typography sx={{ mt: 1, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                            {review.comment}
                        </Typography>
                    )}
                </>
            ) : (
                <Typography color="text.secondary">No review yet</Typography>
            )}
        </Box>
    );
};

/** Small read-only stars for the order list; empty for orders without a review. */
export const ReviewStarsField = () => {
    const record = useRecordContext();
    if (!record?.review) return null;
    return (
        <Rating
            value={record.review.stars}
            readOnly
            size="small"
            getLabelText={ratingLabel}
        />
    );
};
