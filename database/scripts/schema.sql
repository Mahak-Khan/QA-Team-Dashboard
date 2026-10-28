-- ========================================================
-- QA Team Dashboard (QualityHub) Database Schema
-- Database: MySQL 8.0+
-- ========================================================

CREATE DATABASE IF NOT EXISTS `qa_team_dashboard`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `qa_team_dashboard`;

-- --------------------------------------------------------
-- Table: users
-- Roles: 'manager', 'tester'
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'tester',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  INDEX `idx_users_email` (`email`),
  INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: projects
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `projects` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `created_by` INT NULL,
  `excel_sheet_url` VARCHAR(500) NULL,
  `total_bugs` INT NOT NULL DEFAULT 0,
  `open_bugs` INT NOT NULL DEFAULT 0,
  `need_retest_bugs` INT NOT NULL DEFAULT 0,
  `retested_bugs` INT NOT NULL DEFAULT 0,
  `closed_bugs` INT NOT NULL DEFAULT 0,
  `fixed_bugs` INT NOT NULL DEFAULT 0,
  `critical_bugs` INT NOT NULL DEFAULT 0,
  `last_sheet_sync` DATETIME NULL,
  CONSTRAINT `fk_projects_created_by`
    FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  INDEX `idx_projects_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: project_assignments
-- Connects testers to projects
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT NOT NULL,
  `tester_id` INT NOT NULL,
  `assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_assignments_project`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_assignments_tester`
    FOREIGN KEY (`tester_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `uq_project_tester`
    UNIQUE (`project_id`, `tester_id`),
  INDEX `idx_assignments_project` (`project_id`),
  INDEX `idx_assignments_tester` (`tester_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: project_updates
-- Sprint progress logs submitted by testers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_updates` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `assignment_id` INT NOT NULL,
  `sprint_name` VARCHAR(100) NULL,
  `progress` INT NOT NULL DEFAULT 0,
  `remarks` TEXT NULL,
  `excel_sheet_url` VARCHAR(500) NULL,
  `open_bugs` INT NOT NULL DEFAULT 0,
  `need_retest_bugs` INT NOT NULL DEFAULT 0,
  `retested_bugs` INT NOT NULL DEFAULT 0,
  `closed_bugs` INT NOT NULL DEFAULT 0,
  `fixed_bugs` INT NOT NULL DEFAULT 0,
  `critical_bugs` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_updates_assignment`
    FOREIGN KEY (`assignment_id`) REFERENCES `project_assignments` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX `idx_updates_assignment` (`assignment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- --------------------------------------------------------
-- Table: bugs
-- Severity: 'low', 'medium', 'high', 'critical'
-- Status: 'open', 'need_retest', 'retested', 'closed'
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bugs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `project_id` INT NOT NULL,
  `reported_by` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `severity` VARCHAR(20) NOT NULL DEFAULT 'medium',
  `status` VARCHAR(30) NOT NULL DEFAULT 'open',
  `category` VARCHAR(50) NOT NULL DEFAULT 'bug',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bugs_project`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_bugs_reporter`
    FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX `idx_bugs_project` (`project_id`),
  INDEX `idx_bugs_status` (`status`),
  INDEX `idx_bugs_severity` (`severity`),
  INDEX `idx_bugs_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Table: notifications
-- Notification records for project assignments & updates
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `project_id` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'project_assignment',
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notifications_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_notifications_project`
    FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  INDEX `idx_notifications_user` (`user_id`),
  INDEX `idx_notifications_is_read` (`is_read`),
  INDEX `idx_notifications_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

