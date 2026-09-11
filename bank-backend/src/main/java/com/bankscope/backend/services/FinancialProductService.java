package com.bankscope.backend.services;

import com.bankscope.backend.entities.FinancialProductEntity;
import com.bankscope.backend.entities.UserEntity;
import com.bankscope.backend.entities.*;
import com.bankscope.backend.enums.ProductCategory;
import com.bankscope.backend.mappers.FinancialProductMapper;
import com.bankscope.backend.results.FinancialProductResult;
import com.bankscope.backend.vos.BoardPageVo;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.tuple.Pair;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FinancialProductService {

    private final FinancialProductMapper financialProductMapper;

    // 금융 상품 등록 (관리자 전용)
    public FinancialProductResult registerProduct(FinancialProductEntity product, UserEntity user) {
        if (user == null) {
            return FinancialProductResult.FAILURE_SESSION;
        }
        if (!"admin".equals(user.getUserType())) {
            return FinancialProductResult.FAILURE_UNAUTHORIZED;
        }
        if (product.getProductCategory() == null || product.getProductName() == null
                || product.getProductName().isBlank()) {
            return FinancialProductResult.FAILURE;
        }
        product.setIsActive(true);
        product.setCreatedAt(LocalDateTime.now());
        int rows = financialProductMapper.insertProduct(product);
        return rows > 0 ? FinancialProductResult.SUCCESS : FinancialProductResult.FAILURE;
    }

    /**
     * 금융 상품 목록 조회 (카테고리 필터 + 페이지네이션)
     * @param category ProductCategory 이름 문자열 (null 허용 → 전체 조회)
     * @return LEFT: 결과 코드 / RIGHT: Pair(페이지 정보, 상품 목록) — 실패 시 RIGHT=null
     */
    public Pair<FinancialProductResult, Pair<BoardPageVo, List<FinancialProductEntity>>> getProductList(
            String category, int requestPage) {
        // 카테고리 유효성 검사
        String normalizedCategory = null;
        if (category != null && !category.isBlank()) {
            try {
                ProductCategory.valueOf(category.toUpperCase());
                normalizedCategory = category.toUpperCase();
            } catch (IllegalArgumentException e) {
                return Pair.of(FinancialProductResult.FAILURE_INVALID_CATEGORY, null);
            }
        }

        int totalCount = financialProductMapper.countProducts(normalizedCategory);
        BoardPageVo pageVo = new BoardPageVo(requestPage, totalCount);
        List<FinancialProductEntity> products = financialProductMapper.selectProducts(
                normalizedCategory, pageVo.getRowCount(), pageVo.getDbOffset()
        );

        return Pair.of(FinancialProductResult.SUCCESS, Pair.of(pageVo, products));
    }

    /**
     * 금융 상품 목록 조회 (카테고리 + 타겟타입 필터, 페이지네이션 없음)
     */
    public Pair<FinancialProductResult, List<FinancialProductEntity>> getProductListByCategory(
            String category, List<String> targetType) { // String -> List<String> 변경
        // 카테고리 유효성 검사
        String normalizedCategory = null;
        if (category != null && !category.isBlank()) {
            try {
                ProductCategory.valueOf(category.toUpperCase());
                normalizedCategory = category.toUpperCase();
            } catch (IllegalArgumentException e) {
                return Pair.of(FinancialProductResult.FAILURE_INVALID_CATEGORY, null);
            }
        } else {
             return Pair.of(FinancialProductResult.FAILURE_INVALID_CATEGORY, null);
        }

        List<FinancialProductEntity> products = financialProductMapper.selectProductsByCategory(
                normalizedCategory, targetType
        );

        return Pair.of(FinancialProductResult.SUCCESS, products);
    }

    /**
     * 금융 상품 단건 조회
     */
    public Pair<FinancialProductResult, FinancialProductEntity> getProductById(Integer productId) {
        FinancialProductEntity product = financialProductMapper.selectById(productId);
        if (product == null) {
            return Pair.of(FinancialProductResult.FAILURE_PRODUCT_NOT_FOUND, null);
        }
        return Pair.of(FinancialProductResult.SUCCESS, product);
    }

    /**
     * 금융 상품 정보 수정 (관리자 전용)
     */
    public FinancialProductResult updateProduct(FinancialProductEntity product, UserEntity user) {
        if (user == null) {
            return FinancialProductResult.FAILURE_SESSION;
        }
        if (!"admin".equals(user.getUserType())) {
            return FinancialProductResult.FAILURE_UNAUTHORIZED;
        }
        FinancialProductEntity existing = financialProductMapper.selectById(product.getProductId());
        if (existing == null) {
            return FinancialProductResult.FAILURE_PRODUCT_NOT_FOUND;
        }
        product.setUpdatedAt(LocalDateTime.now());
        int rows = financialProductMapper.updateProduct(product);
        return rows > 0 ? FinancialProductResult.SUCCESS : FinancialProductResult.FAILURE;
    }

    /**
     * 금융 상품 비활성화 (소프트 삭제, 관리자 전용)
     */
    public FinancialProductResult deleteProduct(Integer productId, UserEntity user) {
        if (user == null) {
            return FinancialProductResult.FAILURE_SESSION;
        }
        if (!"admin".equals(user.getUserType())) {
            return FinancialProductResult.FAILURE_UNAUTHORIZED;
        }
        FinancialProductEntity existing = financialProductMapper.selectById(productId);
        if (existing == null) {
            return Pair.of(FinancialProductResult.FAILURE_PRODUCT_NOT_FOUND, null).getLeft();
        }
        int rows = financialProductMapper.deactivateProduct(productId);
        return rows > 0 ? FinancialProductResult.SUCCESS : FinancialProductResult.FAILURE;
    }

}