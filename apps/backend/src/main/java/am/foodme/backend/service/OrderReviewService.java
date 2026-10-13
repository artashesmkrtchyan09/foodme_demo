package am.foodme.backend.service;

import am.foodme.backend.dto.OrderReviewDto;
import am.foodme.backend.dto.OrderReviewRequestDto;
import am.foodme.backend.exceptionHandler.BadRequestException;
import am.foodme.backend.exceptionHandler.NotFoundException;
import am.foodme.backend.model.Chef;
import am.foodme.backend.model.Customer;
import am.foodme.backend.model.Order;
import am.foodme.backend.model.OrderReview;
import am.foodme.backend.repository.ChefRepository;
import am.foodme.backend.repository.CustomerRepository;
import am.foodme.backend.repository.OrderRepository;
import am.foodme.backend.repository.OrderReviewRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

@Service
public class OrderReviewService {

    static final String ONLY_DELIVERED = "Only delivered orders can be reviewed.";
    static final String ALREADY_REVIEWED = "Order already reviewed.";

    private final OrderReviewRepository orderReviewRepository;
    private final OrderRepository orderRepository;
    private final CustomerRepository customerRepository;
    private final ChefRepository chefRepository;

    public OrderReviewService(OrderReviewRepository orderReviewRepository, OrderRepository orderRepository,
                              CustomerRepository customerRepository, ChefRepository chefRepository) {
        this.orderReviewRepository = orderReviewRepository;
        this.orderRepository = orderRepository;
        this.customerRepository = customerRepository;
        this.chefRepository = chefRepository;
    }

    @Transactional
    public OrderReviewDto create(String customerEmail, String orderNumber, OrderReviewRequestDto request) {
        Customer customer = customerRepository.findByEmail(customerEmail == null ? "" : customerEmail.trim().toLowerCase())
                .orElseThrow(() -> new NotFoundException("Customer not found"));

        // Someone else's order is reported exactly like a missing one, so order numbers can't be probed.
        Order order = orderRepository.findByNumber(orderNumber)
                .filter(o -> o.getCustomer() != null && o.getCustomer().getId().equals(customer.getId()))
                .orElseThrow(() -> new NotFoundException("Order " + orderNumber + " not found"));

        if (!"DELIVERED".equals(order.getStatus())) {
            throw new BadRequestException(ONLY_DELIVERED);
        }
        if (orderReviewRepository.existsByOrderId(order.getId())) {
            throw new BadRequestException(ALREADY_REVIEWED);
        }

        OrderReview review = new OrderReview();
        review.setOrder(order);
        review.setCustomer(customer);
        review.setChef(order.getChef());
        review.setStars(request.getStars().intValueExact());
        review.setComment(request.getComment() == null || request.getComment().isBlank()
                ? null : request.getComment().trim());
        review.setCreatedAt(LocalDateTime.now());

        try {
            // Flush now so a concurrent second review hits the unique order_id constraint here.
            orderReviewRepository.saveAndFlush(review);
        } catch (DataIntegrityViolationException ex) {
            throw new BadRequestException(ALREADY_REVIEWED);
        }

        updateChefRating(order.getChef());
        return OrderReviewDto.mapEntityToDto(review);
    }

    /** The chef's rating is the average of all their order ratings, rounded to one decimal. */
    private void updateChefRating(Chef chef) {
        Double average = orderReviewRepository.averageStarsForChef(chef.getId());
        if (average == null) {
            return;
        }
        chef.setRating(BigDecimal.valueOf(average).setScale(1, RoundingMode.HALF_UP).doubleValue());
        chefRepository.save(chef);
    }
}
