ALTER TABLE trip_requests
    ADD COLUMN payment_method VARCHAR(10) NOT NULL DEFAULT 'cash' AFTER estimated_fare,
    ADD COLUMN service_tier VARCHAR(20) NOT NULL DEFAULT 'economico' AFTER payment_method;
