ALTER TABLE trips
    ADD COLUMN is_pooling_allowed TINYINT(1) NOT NULL DEFAULT 1 AFTER base_fare,
    ADD COLUMN payment_method VARCHAR(10) NOT NULL DEFAULT 'cash' AFTER is_pooling_allowed,
    ADD COLUMN service_tier VARCHAR(20) NOT NULL DEFAULT 'economico' AFTER payment_method;
