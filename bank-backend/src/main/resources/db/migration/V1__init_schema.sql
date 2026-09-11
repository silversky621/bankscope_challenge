-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: bank
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `account`
--

DROP TABLE IF EXISTS `account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `account` (
  `account_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `product_id` int unsigned DEFAULT NULL,
  `account_number` varchar(40) NOT NULL,
  `account_type` varchar(20) NOT NULL,
  `balance` bigint NOT NULL DEFAULT '0',
  `account_password` varchar(255) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
  `password_fail_count` int DEFAULT '0',
  `account_alias` varchar(20) DEFAULT NULL,
  `interest_rate` decimal(5,2) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_transaction_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `maturity_date` datetime DEFAULT NULL,
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `account_number` (`account_number`),
  KEY `user_id` (`user_id`),
  KEY `fk_account_product` (`product_id`),
  CONSTRAINT `account_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_account_product` FOREIGN KEY (`product_id`) REFERENCES `financial_product` (`product_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=117 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `account`
--

LOCK TABLES `account` WRITE;
/*!40000 ALTER TABLE `account` DISABLE KEYS */;
/*!40000 ALTER TABLE `account` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `board`
--

DROP TABLE IF EXISTS `board`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `board` (
  `board_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `board_type` varchar(20) NOT NULL,
  `title` varchar(200) NOT NULL,
  `content` text NOT NULL,
  `view_count` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`board_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `board_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `board`
--

LOCK TABLES `board` WRITE;
/*!40000 ALTER TABLE `board` DISABLE KEYS */;
/*!40000 ALTER TABLE `board` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `card`
--

DROP TABLE IF EXISTS `card`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `card` (
  `card_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `account_id` bigint DEFAULT NULL,
  `card_name` varchar(50) DEFAULT NULL,
  `card_number` varchar(20) NOT NULL,
  `card_type` varchar(20) NOT NULL,
  `cvc` varchar(3) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
  `valid_thru` varchar(5) NOT NULL,
  `issued_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `credit_limit` bigint DEFAULT NULL,
  `used_amount` bigint DEFAULT NULL,
  `payment_day` int DEFAULT NULL,
  `card_color` varchar(20) DEFAULT NULL,
  `is_activated` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`card_id`),
  UNIQUE KEY `card_number` (`card_number`),
  KEY `fk_card_user` (`user_id`),
  KEY `fk_card_account` (`account_id`),
  CONSTRAINT `fk_card_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_card_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `card`
--

LOCK TABLES `card` WRITE;
/*!40000 ALTER TABLE `card` DISABLE KEYS */;
/*!40000 ALTER TABLE `card` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `corporate_management`
--

DROP TABLE IF EXISTS `corporate_management`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `corporate_management` (
  `corporate_manage_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `loan_id` int NOT NULL,
  `risk_grade` varchar(20) NOT NULL,
  `default_date` date NOT NULL,
  `reason` varchar(100) NOT NULL,
  `description` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`corporate_manage_id`),
  KEY `fk_corp_user` (`user_id`),
  KEY `fk_corp_loan` (`loan_id`),
  CONSTRAINT `fk_corp_loan` FOREIGN KEY (`loan_id`) REFERENCES `loan` (`loan_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_corp_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `corporate_management`
--

LOCK TABLES `corporate_management` WRITE;
/*!40000 ALTER TABLE `corporate_management` DISABLE KEYS */;
/*!40000 ALTER TABLE `corporate_management` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deposit_account`
--

DROP TABLE IF EXISTS `deposit_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deposit_account` (
  `account_id` bigint NOT NULL,
  `linked_account_id` bigint NOT NULL,
  `maturity_treatment` enum('AUTO_TERMINATE','AUTO_RENEW') NOT NULL DEFAULT 'AUTO_TERMINATE',
  PRIMARY KEY (`account_id`),
  KEY `linked_account_id` (`linked_account_id`),
  CONSTRAINT `deposit_account_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE CASCADE,
  CONSTRAINT `deposit_account_ibfk_2` FOREIGN KEY (`linked_account_id`) REFERENCES `account` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deposit_account`
--

LOCK TABLES `deposit_account` WRITE;
/*!40000 ALTER TABLE `deposit_account` DISABLE KEYS */;
/*!40000 ALTER TABLE `deposit_account` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `email_tokens`
--

DROP TABLE IF EXISTS `email_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `email_tokens` (
  `email` varchar(50) NOT NULL,
  `code` varchar(12) NOT NULL,
  `is_verified` tinyint(1) DEFAULT '0',
  `is_used` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`email`,`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `email_tokens`
--

LOCK TABLES `email_tokens` WRITE;
/*!40000 ALTER TABLE `email_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `email_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `financial_product`
--

DROP TABLE IF EXISTS `financial_product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `financial_product` (
  `product_id` int unsigned NOT NULL AUTO_INCREMENT,
  `product_category` enum('CHECKING','DEPOSIT','SAVINGS','LOAN') NOT NULL,
  `product_name` varchar(100) NOT NULL,
  `base_interest_rate` decimal(5,2) NOT NULL,
  `max_interest_rate` decimal(5,2) DEFAULT NULL,
  `min_duration_months` int DEFAULT NULL,
  `max_duration_months` int DEFAULT NULL,
  `min_amount` bigint DEFAULT NULL,
  `max_amount` bigint DEFAULT NULL,
  `description` text,
  `is_active` tinyint(1) DEFAULT '1',
  `target_type` enum('INDIVIDUAL','CORPORATE','ALL') DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `min_age` int DEFAULT NULL,
  `max_age` int DEFAULT NULL,
  PRIMARY KEY (`product_id`)
) ENGINE=InnoDB AUTO_INCREMENT=113 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `financial_product`
--

LOCK TABLES `financial_product` WRITE;
/*!40000 ALTER TABLE `financial_product` DISABLE KEYS */;
/*!40000 ALTER TABLE `financial_product` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loan`
--

DROP TABLE IF EXISTS `loan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan` (
  `loan_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `product_id` int unsigned NOT NULL,
  `linked_account_id` bigint NOT NULL,
  `principal_amount` bigint NOT NULL,
  `outstanding_amount` bigint NOT NULL,
  `interest_rate` decimal(5,2) NOT NULL,
  `payment_day` tinyint NOT NULL,
  `info` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
  `overdue_date` date DEFAULT NULL,
  `overdue_amount` bigint NOT NULL DEFAULT '0',
  `maturity_date` date NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`loan_id`),
  KEY `fk_loan_user` (`user_id`),
  KEY `fk_loan_product` (`product_id`),
  KEY `fk_loan_account` (`linked_account_id`),
  CONSTRAINT `fk_loan_account` FOREIGN KEY (`linked_account_id`) REFERENCES `account` (`account_id`),
  CONSTRAINT `fk_loan_product` FOREIGN KEY (`product_id`) REFERENCES `financial_product` (`product_id`),
  CONSTRAINT `fk_loan_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loan`
--

LOCK TABLES `loan` WRITE;
/*!40000 ALTER TABLE `loan` DISABLE KEYS */;
/*!40000 ALTER TABLE `loan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loan_schedule`
--

DROP TABLE IF EXISTS `loan_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loan_schedule` (
  `schedule_id` bigint NOT NULL AUTO_INCREMENT,
  `loan_id` int NOT NULL,
  `due_date` date NOT NULL,
  `repay_amount` decimal(15,2) NOT NULL,
  `status` varchar(20) DEFAULT 'SCHEDULED',
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`schedule_id`),
  KEY `fk_loan_schedule_loan` (`loan_id`),
  CONSTRAINT `fk_loan_schedule_loan` FOREIGN KEY (`loan_id`) REFERENCES `loan` (`loan_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loan_schedule`
--

LOCK TABLES `loan_schedule` WRITE;
/*!40000 ALTER TABLE `loan_schedule` DISABLE KEYS */;
/*!40000 ALTER TABLE `loan_schedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `member`
--

DROP TABLE IF EXISTS `member`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `member` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(30) NOT NULL,
  `level` int unsigned DEFAULT '1',
  `auth` varchar(20) DEFAULT '사원',
  `team` varchar(50) DEFAULT NULL,
  `status` tinyint(1) DEFAULT '1',
  `counter_number` int DEFAULT NULL,
  `join_date` date DEFAULT (curdate()),
  `last_login` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `member`
--

LOCK TABLES `member` WRITE;
/*!40000 ALTER TABLE `member` DISABLE KEYS */;
/*!40000 ALTER TABLE `member` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_subscription`
--

DROP TABLE IF EXISTS `product_subscription`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_subscription` (
  `subscription_id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `product_id` int unsigned NOT NULL,
  `task_id` bigint DEFAULT NULL,
  `amount` bigint DEFAULT NULL,
  `duration_months` int DEFAULT NULL,
  `applied_interest_rate` decimal(5,2) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'ACTIVE',
  `payment_day` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`subscription_id`),
  KEY `fk_sub_product` (`product_id`),
  KEY `fk_sub_user` (`user_id`),
  CONSTRAINT `fk_sub_product` FOREIGN KEY (`product_id`) REFERENCES `financial_product` (`product_id`),
  CONSTRAINT `fk_sub_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_subscription`
--

LOCK TABLES `product_subscription` WRITE;
/*!40000 ALTER TABLE `product_subscription` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_subscription` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `savings_account`
--

DROP TABLE IF EXISTS `savings_account`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `savings_account` (
  `account_id` bigint NOT NULL,
  `linked_account_id` bigint NOT NULL,
  `installment_amount` bigint NOT NULL,
  `term_months` int NOT NULL,
  `payment_day` int NOT NULL,
  `maturity_date` date NOT NULL,
  PRIMARY KEY (`account_id`),
  KEY `fk_savings_to_linked_account` (`linked_account_id`),
  CONSTRAINT `fk_savings_to_base_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_savings_to_linked_account` FOREIGN KEY (`linked_account_id`) REFERENCES `account` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `savings_account`
--

LOCK TABLES `savings_account` WRITE;
/*!40000 ALTER TABLE `savings_account` DISABLE KEYS */;
/*!40000 ALTER TABLE `savings_account` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `savings_schedule`
--

DROP TABLE IF EXISTS `savings_schedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `savings_schedule` (
  `schedule_id` bigint NOT NULL AUTO_INCREMENT,
  `account_id` bigint NOT NULL,
  `due_date` date NOT NULL,
  `installment_amount` decimal(15,2) NOT NULL,
  `status` varchar(20) DEFAULT 'PENDING',
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`schedule_id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `savings_schedule_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `savings_schedule`
--

LOCK TABLES `savings_schedule` WRITE;
/*!40000 ALTER TABLE `savings_schedule` DISABLE KEYS */;
/*!40000 ALTER TABLE `savings_schedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sms_auth`
--

DROP TABLE IF EXISTS `sms_auth`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sms_auth` (
  `phone_number` varchar(20) NOT NULL,
  `auth_code` varchar(6) NOT NULL,
  `is_verified` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sms_auth`
--

LOCK TABLES `sms_auth` WRITE;
/*!40000 ALTER TABLE `sms_auth` DISABLE KEYS */;
/*!40000 ALTER TABLE `sms_auth` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task`
--

DROP TABLE IF EXISTS `task`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task` (
  `task_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `ticket_number` varchar(20) NOT NULL,
  `task_type` varchar(50) NOT NULL,
  `task_detail_type` varchar(50) NOT NULL,
  `assigned_level` varchar(20) DEFAULT NULL,
  `expected_waiting_time` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'WAITING',
  `member_id` int unsigned DEFAULT NULL,
  `ranking` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_ai` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`task_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `task_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task`
--

LOCK TABLES `task` WRITE;
/*!40000 ALTER TABLE `task` DISABLE KEYS */;
/*!40000 ALTER TABLE `task` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `task_processing_log`
--

DROP TABLE IF EXISTS `task_processing_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `task_processing_log` (
  `log_id` bigint NOT NULL AUTO_INCREMENT,
  `task_id` bigint NOT NULL,
  `member_id` int unsigned NOT NULL,
  `action_type` varchar(50) NOT NULL,
  `processing_note` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`log_id`),
  KEY `fk_log_task` (`task_id`),
  KEY `fk_log_member` (`member_id`),
  CONSTRAINT `fk_log_member` FOREIGN KEY (`member_id`) REFERENCES `member` (`id`),
  CONSTRAINT `fk_log_task` FOREIGN KEY (`task_id`) REFERENCES `task` (`task_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `task_processing_log`
--

LOCK TABLES `task_processing_log` WRITE;
/*!40000 ALTER TABLE `task_processing_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `task_processing_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaction_history`
--

DROP TABLE IF EXISTS `transaction_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaction_history` (
  `transaction_id` bigint NOT NULL AUTO_INCREMENT,
  `account_id` bigint NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `task_id` bigint DEFAULT NULL,
  `transaction_type` varchar(50) NOT NULL,
  `amount` bigint NOT NULL,
  `balance_after` bigint NOT NULL,
  `description` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`transaction_id`),
  KEY `fk_tx_account` (`account_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `fk_tx_account` FOREIGN KEY (`account_id`) REFERENCES `account` (`account_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `transaction_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=960 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaction_history`
--

LOCK TABLES `transaction_history` WRITE;
/*!40000 ALTER TABLE `transaction_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `transaction_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user_type` varchar(25) DEFAULT NULL,
  `name` varchar(50) NOT NULL,
  `email` varchar(50) DEFAULT NULL,
  `resident_number` varchar(100) NOT NULL,
  `identification_number` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(100) DEFAULT NULL,
  `gender` enum('MALE','FEMALE') DEFAULT NULL,
  `age` varchar(20) DEFAULT NULL,
  `grade` varchar(20) DEFAULT NULL,
  `is_terms_agreed` tinyint(1) NOT NULL DEFAULT '0' COMMENT '필수 약관 전체 동의 여부',
  PRIMARY KEY (`id`),
  UNIQUE KEY `resident_number` (`resident_number`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `identification_number` (`identification_number`)
) ENGINE=InnoDB AUTO_INCREMENT=2762 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_pin`
--

DROP TABLE IF EXISTS `user_pin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_pin` (
  `pin_id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int unsigned NOT NULL,
  `pin_hash` varchar(255) NOT NULL,
  `fail_count` int NOT NULL DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pin_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_pin_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_pin`
--

LOCK TABLES `user_pin` WRITE;
/*!40000 ALTER TABLE `user_pin` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_pin` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-30  5:30:21
