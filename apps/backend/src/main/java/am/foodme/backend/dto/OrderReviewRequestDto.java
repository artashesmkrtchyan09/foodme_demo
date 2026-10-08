package am.foodme.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderReviewRequestDto {
    // BigDecimal rather than Integer: Jackson would silently truncate 4.5 to 4 for an Integer.
    @NotNull(message = "Rating is required")
    @DecimalMin(value = "1", message = "Rating must be a whole number from 1 to 5")
    @DecimalMax(value = "5", message = "Rating must be a whole number from 1 to 5")
    @Digits(integer = 1, fraction = 0, message = "Rating must be a whole number from 1 to 5")
    private BigDecimal stars;

    @Size(max = 1000, message = "Comment must be at most 1000 characters")
    private String comment;
}
