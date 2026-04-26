-- Create Database
CREATE DATABASE IF NOT EXISTS sales_tracker;
USE sales_tracker;

-- Create Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    image_data LONGTEXT, -- Stores Base64 string
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
