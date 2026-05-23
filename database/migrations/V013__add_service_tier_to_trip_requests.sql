ALTER TABLE trip_requests
    ADD COLUMN service_tier VARCHAR(20) NOT NULL DEFAULT 'economico'
    AFTER payment_method;
