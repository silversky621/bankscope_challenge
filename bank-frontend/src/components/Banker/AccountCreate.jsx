import React, { useState, useEffect } from "react";
import styles from "./AccountCreate.module.css";
import { useModal } from '../../context/ModalContext';

const AccountCreate = ({
                         accountAlias,
                         setAccountAlias,
                         accountPassword,
                         setAccountPassword,
                         confirmPassword,
                         amount,
                         setAmount, // amount를 변경할 수 있는 setter 함수 추가
                         setConfirmPassword,
                         onCreate,
                         productId,
                         setProductId,
                       }) => {
  const [products, setProducts] = useState([]);
  const { openModal } = useModal();
  const showAlert = (message, callback = null) => {
    openModal({
      message: message,
      onConfirm: callback
    });
  };
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(
            "/api/product/list?category=CHECKING&targetType=ALL&targetType=INDIVIDUAL"
        );

        if (response.ok) {
          const data = await response.json();
          switch (data.result) {
            case "SUCCESS":
              setProducts(data.products || []);
              // 기본 선택 값을 빈 문자열로 설정하여 "상품을 선택하세요"가 보이도록 함
              if (!productId) {
                setProductId("");
              }
              break;
            case "FAILURE":
            case "FAILURE_USER_NOT_EXIST":
            case "FAILURE_PRODUCT_NOT_FOUND":
            case "FAILURE_NOT_CORPORATE_USER":
              showAlert(`상품 목록 조회 실패: ${data.result}`);
              break;
            default:
              showAlert("알 수 없는 오류로 상품 목록을 불러오지 못했습니다.");
              break;
          }
        } else {
          showAlert("상품 목록을 불러오는 중 오류가 발생했습니다.");
        }
      } catch (error) {
        showAlert("상품 목록을 불러오는 중 네트워크 오류가 발생했습니다.", error);
      }
    };

    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProduct = products.find(p => p.productId === Number(productId));

  return (
      <div className={styles.accountForm}>
        <h2>입출금 계좌 개설</h2>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>상품명</label>
            <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
            >
              <option value="">상품을 선택하세요</option>
              {products.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.productName}
                  </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>초기입금 금액</label>
            <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="금액을 입력하세요 (원)"
            />
          </div>
        </div>

        {selectedProduct && (
            <div className={styles.infoBox}>
              <strong>기본금리:</strong> 연 {selectedProduct.baseInterestRate}% | <strong>최고금리:</strong> 연 {selectedProduct.maxInterestRate}%<br/>
                <strong>가입금액:</strong> {selectedProduct.minAmount?.toLocaleString() ?? 0}원 ~ {selectedProduct.maxAmount?.toLocaleString() ?? 0}원<br/>
              <strong>설명:</strong> {selectedProduct.description}
            </div>
        )}

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>별칭</label>
            <input
                type="text"
                value={accountAlias}
                onChange={(e) => setAccountAlias(e.target.value)}
                placeholder="계좌 별칭을 입력하세요"
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>비밀번호 (4자리)</label>
            <input
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                maxLength="4"
                placeholder="4자리 숫자"
            />
          </div>

          <div className={styles.formGroup}>
            <label>비밀번호 확인</label>
            <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                maxLength="4"
                placeholder="4자리 숫자"
            />
          </div>
        </div>


        <div className={styles.accountBtnRow}>
          <button
              className={styles.btnCreate}
              onClick={onCreate}
              disabled={!productId}
          >
            계좌 생성
          </button>
        </div>
      </div>
  );
};

export default AccountCreate;
