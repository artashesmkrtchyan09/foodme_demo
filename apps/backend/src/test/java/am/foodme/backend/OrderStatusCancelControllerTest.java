package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
// Named to sort after OrderControllerTest: Gradle runs classes alphabetically, and orders
// placed here before it would make the seeded FM-FLAKE-02 tests (first order is FM-100001)
// fail every run instead of intermittently.
class OrderStatusCancelControllerTest {

    private static final String ONLY_NEW_MESSAGE = "Only new orders can be cancelled.";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MeterRegistry meterRegistry;

    // qase: 124
    @Test
    void cancel_ownNewOrder_returnsCancelled() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void cancel_ownNewOrder_showsCancelledInOrderHistoryAndTracking() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);

        cancel(number, token);

        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[?(@.number == '" + number + "')].status").value(hasItem("CANCELLED")));
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    // qase: 134
    @Test
    void cancel_ownNewOrder_incrementsCancelledOrdersCounter() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        double before = meterRegistry.counter("foodme.orders.cancelled").count();

        cancel(number, token);

        assertThat(meterRegistry.counter("foodme.orders.cancelled").count()).isEqualTo(before + 1);
    }

    // qase: 135
    @Test
    void cancel_refusedCancel_doesNotIncrementCancelledOrdersCounter() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        cancel(number, token);
        double before = meterRegistry.counter("foodme.orders.cancelled").count();

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());

        assertThat(meterRegistry.counter("foodme.orders.cancelled").count()).isEqualTo(before);
    }

    // qase: 125
    @Test
    void cancel_acceptedOrder_rejectedWithBadRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        adminSetStatus(orderId(number), "ACCEPTED");

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(ONLY_NEW_MESSAGE));
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    // qase: 126
    @Test
    void cancel_rejectedOrder_rejectedWithBadRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        Long id = orderId(number);
        mockMvc.perform(patch("/admin/order/" + id + "/status")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "REJECTED", "rejectReason", "Out of stock"))))
                .andExpect(status().isOk());

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(ONLY_NEW_MESSAGE));
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("REJECTED"));
    }

    // qase: 127
    @Test
    void cancel_deliveredOrder_rejectedWithBadRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        Long id = orderId(number);
        adminSetStatus(id, "ACCEPTED");
        adminSetStatus(id, "DELIVERED");

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(ONLY_NEW_MESSAGE));
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("DELIVERED"));
    }

    // qase: 128
    @Test
    void cancel_alreadyCancelledOrder_rejectedWithBadRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        cancel(number, token);

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(ONLY_NEW_MESSAGE));
    }

    // qase: 129
    @Test
    void cancel_otherCustomersOrder_notFoundAndOrderUnchanged() throws Exception {
        String number = placeOrder(customerToken());

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + customerToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Order " + number + " not found"));
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    // qase: 130
    @Test
    void cancel_unknownOrder_notFound() throws Exception {
        String number = "FM-NOPE-" + UUID.randomUUID();

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + customerToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Order " + number + " not found"));
    }

    // qase: 131
    @Test
    void cancel_withoutToken_unauthorized() throws Exception {
        String number = placeOrder(customerToken());

        mockMvc.perform(post(cancelPath(number)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    // qase: 132
    @Test
    void cancel_withAdminToken_forbidden() throws Exception {
        String number = placeOrder(customerToken());

        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    // qase: 133
    @ParameterizedTest
    @ValueSource(strings = {"NEW", "ACCEPTED", "DELIVERED", "REJECTED"})
    void adminUpdateStatus_cancelledOrder_rejected(String targetStatus) throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        cancel(number, token);
        Long id = orderId(number);

        mockMvc.perform(patch("/admin/order/" + id + "/status")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", targetStatus))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Order was cancelled by the customer and can't be changed."));
        mockMvc.perform(get("/admin/order/" + id).header("Authorization", "Bearer " + adminToken()))
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void adminUpdateStatus_toCancelled_rejected() throws Exception {
        String number = placeOrder(customerToken());

        mockMvc.perform(patch("/admin/order/" + orderId(number) + "/status")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CANCELLED"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Cannot transition order from NEW to CANCELLED"));
    }

    @Test
    void adminList_filterByCancelled_containsCancelledOrder() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        cancel(number, token);

        mockMvc.perform(get("/admin/order")
                        .param("status", "CANCELLED")
                        .param("size", "200")
                        .header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[*].number").value(hasItem(number)))
                .andExpect(jsonPath("$.list[?(@.status != 'CANCELLED')]").isEmpty());
    }

    private static String cancelPath(String number) {
        return "/api/customer/orders/" + number + "/cancel";
    }

    private void cancel(String number, String token) throws Exception {
        mockMvc.perform(post(cancelPath(number)).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    private String placeOrder(String token) throws Exception {
        Map<String, Object> body = Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 1))
        );
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("number").asText();
    }

    private Long orderId(String number) throws Exception {
        String response = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void adminSetStatus(Long id, String status) throws Exception {
        mockMvc.perform(patch("/admin/order/" + id + "/status")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", status))))
                .andExpect(status().isOk());
    }

    private String customerToken() throws Exception {
        String email = "cancel-test-" + UUID.randomUUID() + "@example.com";
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Ann",
                                "email", email,
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
                        .content(objectMapper.writeValueAsString(Map.of("username", "admin", "password", "admin123"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }
}
