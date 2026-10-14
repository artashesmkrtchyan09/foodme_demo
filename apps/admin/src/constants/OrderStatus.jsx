const OrderStatus = {
    NEW: 'NEW',
    ACCEPTED: 'ACCEPTED',
    DELIVERED: 'DELIVERED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED',
};

const OrderStatusColors = {
    [OrderStatus.NEW]: 'info',
    [OrderStatus.ACCEPTED]: 'warning',
    [OrderStatus.DELIVERED]: 'success',
    [OrderStatus.REJECTED]: 'error',
    [OrderStatus.CANCELLED]: 'default',
};

// Allowed forward transitions per current status.
// CANCELLED is set only by the customer, before the kitchen accepts, and is final.
const OrderStatusTransitions = {
    [OrderStatus.NEW]: [OrderStatus.ACCEPTED, OrderStatus.REJECTED],
    [OrderStatus.ACCEPTED]: [OrderStatus.DELIVERED, OrderStatus.REJECTED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.REJECTED]: [],
    [OrderStatus.CANCELLED]: [],
};

// Orders that bring in no money: excluded from revenue figures.
const NonRevenueStatuses = [OrderStatus.REJECTED, OrderStatus.CANCELLED];

export { OrderStatus, OrderStatusColors, OrderStatusTransitions, NonRevenueStatuses };
