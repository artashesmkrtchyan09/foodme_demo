package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Order ratings (SCRUM-8). Chef 1 (dish 1) is used for the per-order rules; chef 2 (dish 3) is
 * reviewed only by {@link #review_severalOrders_chefRatingIsRoundedAverage()}, so its average is
 * known regardless of what other tests in the run do.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderReviewControllerTest {

    private static final String WHOLE_STARS_MESSAGE = "Rating must be a whole number from 1 to 5";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void review_deliveredOwnOrder_savedAndShownOnOrder() throws Exception {
        String token = customerToken();
        String number = placeDeliveredOrder(token, 1);

        mockMvc.perform(review(token, number, reviewPayload(4, "Great khashlama")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stars").value(4))
                .andExpect(jsonPath("$.comment").value("Great khashlama"))
                .andExpect(jsonPath("$.createdAt", notNullValue()));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.stars").value(4))
                .andExpect(jsonPath("$.review.comment").value("Great khashlama"));

        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[?(@.number == '" + number + "')].review.stars").value(4));
    }

    @Test
    void review_withoutComment_succeeds() throws Exception {
        String token = customerToken();
        String number = placeDeliveredOrder(token, 1);

        mockMvc.perform(review(token, number, reviewPayload(5, null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.stars").value(5))
                .andExpect(jsonPath("$.comment").doesNotExist());
    }

    @Test
    void review_shownOnAdminOrderDetails() throws Exception {
        String token = customerToken();
        String number = placeDeliveredOrder(token, 1);
        mockMvc.perform(review(token, number, reviewPayload(2, "Arrived cold")))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/admin/order/" + orderId(number)).header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.stars").value(2))
                .andExpect(jsonPath("$.review.comment").value("Arrived cold"))
                .andExpect(jsonPath("$.review.createdAt", notNullValue()));
    }

    @Test
    void order_notReviewed_hasNoReview() throws Exception {
        String token = customerToken();
        String number = placeDeliveredOrder(token, 1);

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review").doesNotExist());
    }

    @Test
    void review_secondTime_rejected() throws Exception {
        String token = customerToken();
        String number = placeDeliveredOrder(token, 1);
        mockMvc.perform(review(token, number, reviewPayload(5, null)))
                .andExpect(status().isCreated());

        mockMvc.perform(review(token, number, reviewPayload(1, "changed my mind")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Order already reviewed."));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review.stars").value(5));
    }

    @Test
    void review_newOrder_rejected() throws Exception {
        String token = customerToken();
        String number = placeOrder(token, 1);

        mockMvc.perform(review(token, number, reviewPayload(5, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only delivered orders can be reviewed."));
    }

    @Test
    void review_acceptedOrder_rejected() throws Exception {
        String token = customerToken();
        String number = placeOrder(token, 1);
        changeStatus(orderId(number), "ACCEPTED");

        mockMvc.perform(review(token, number, reviewPayload(5, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only delivered orders can be reviewed."));
    }

    @Test
    void review_rejectedOrder_rejected() throws Exception {
        String token = customerToken();
        String number = placeOrder(token, 1);
        changeStatus(orderId(number), "REJECTED");

        mockMvc.perform(review(token, number, reviewPayload(5, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only delivered orders can be reviewed."));
    }

    @Test
    void review_someoneElsesOrder_notFound() throws Exception {
        String number = placeDeliveredOrder(customerToken(), 1);

        mockMvc.perform(review(customerToken(), number, reviewPayload(5, null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Order " + number + " not found"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review").doesNotExist());
    }

    @Test
    void review_unknownOrder_notFound() throws Exception {
        mockMvc.perform(review(customerToken(), "FM-999999999", reviewPayload(5, null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Order FM-999999999 not found"));
    }

    @Test
    void review_withoutToken_unauthorized() throws Exception {
        String number = placeDeliveredOrder(customerToken(), 1);

        mockMvc.perform(post("/api/customer/orders/" + number + "/review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewPayload(5, null)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void review_withAdminToken_forbidden() throws Exception {
        String number = placeDeliveredOrder(customerToken(), 1);

        mockMvc.perform(review(adminToken(), number, reviewPayload(5, null)))
                .andExpect(status().isForbidden());
    }

    @Test
    void review_zeroStars_rejected() throws Exception {
        assertStarsRejected(0, WHOLE_STARS_MESSAGE);
    }

    @Test
    void review_sixStars_rejected() throws Exception {
        assertStarsRejected(6, WHOLE_STARS_MESSAGE);
    }

    @Test
    void review_fractionalStars_rejected() throws Exception {
        assertStarsRejected(4.5, WHOLE_STARS_MESSAGE);
    }

    @Test
    void review_missingStars_rejected() throws Exception {
        assertStarsRejected(null, "Rating is required");
    }

    @Test
    void review_comment1000Characters_accepted() throws Exception {
        String token = customerToken();
        String number = placeDeliveredOrder(token, 1);

        mockMvc.perform(review(token, number, reviewPayload(3, "a".repeat(1000))))
                .andExpect(status().isCreated());
    }

    @Test
    void review_comment1001Characters_rejected() throws Exception {
        String token = customerToken();
        String number = placeDeliveredOrder(token, 1);

        mockMvc.perform(review(token, number, reviewPayload(3, "a".repeat(1001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Comment must be at most 1000 characters"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review").doesNotExist());
    }

    @Test
    void review_severalOrders_chefRatingIsRoundedAverage() throws Exception {
        String token = customerToken();
        mockMvc.perform(review(token, placeDeliveredOrder(token, 3), reviewPayload(5, null)))
                .andExpect(status().isCreated());
        mockMvc.perform(get("/api/chef/2"))
                .andExpect(jsonPath("$.rating", closeTo(5.0, 0.001)));

        mockMvc.perform(review(token, placeDeliveredOrder(token, 3), reviewPayload(4, null)))
                .andExpect(status().isCreated());
        mockMvc.perform(review(token, placeDeliveredOrder(token, 3), reviewPayload(4, null)))
                .andExpect(status().isCreated());

        // (5 + 4 + 4) / 3 = 4.333… → 4.3
        mockMvc.perform(get("/api/chef/2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating", closeTo(4.3, 0.001)));
    }

    private void assertStarsRejected(Object stars, String message) throws Exception {
        String token = customerToken();
        String number = placeDeliveredOrder(token, 1);

        mockMvc.perform(review(token, number, reviewPayload(stars, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(message));
    }

    private org.springframework.test.web.servlet.RequestBuilder review(String token, String number, String body) {
        return post("/api/customer/orders/" + number + "/review")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
    }

    private String reviewPayload(Object stars, String comment) throws Exception {
        // HashMap rather than Map.of: the tests need null values.
        Map<String, Object> body = new HashMap<>();
        body.put("stars", stars);
        body.put("comment", comment);
        return objectMapper.writeValueAsString(body);
    }

    private String placeDeliveredOrder(String token, long dishId) throws Exception {
        String number = placeOrder(token, dishId);
        long id = orderId(number);
        changeStatus(id, "ACCEPTED");
        changeStatus(id, "DELIVERED");
        return number;
    }

    private String placeOrder(String token, long dishId) throws Exception {
        long chefId = dishId == 3 ? 2 : 1;
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "chefId", chefId,
                                "receiverName", "Rita Review",
                                "receiverPhoneNumber", "+37491234567",
                                "receiverEmail", "rita@example.com",
                                "paymentType", "CASH",
                                "deliveryMethod", "TAKEAWAY",
                                "createOrderDishes", List.of(Map.of("dishId", dishId, "quantity", 1))
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("number").asText();
    }

    private long orderId(String number) throws Exception {
        String response = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void changeStatus(long orderId, String status) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("status", status);
        body.put("rejectReason", "REJECTED".equals(status) ? "Out of ingredients" : null);
        mockMvc.perform(patch("/admin/order/" + orderId + "/status")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(status));
    }

    private String customerToken() throws Exception {
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Rita Review",
                                "email", "review-" + UUID.randomUUID() + "@example.com",
                                "phoneNumber", "+37491234567",
                                "password", "secret123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private String adminToken() throws Exception {
        String response = mockMvc.perform(post("/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "admin",
                                "password", "admin123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }
}
