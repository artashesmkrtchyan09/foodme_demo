package am.foodme.backend.repository;

import am.foodme.backend.model.OrderReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderReviewRepository extends JpaRepository<OrderReview, Long> {
    boolean existsByOrderId(Long orderId);

    @Query("SELECT AVG(r.stars) FROM OrderReview r WHERE r.chef.id = :chefId")
    Double averageStarsForChef(@Param("chefId") Long chefId);
}
