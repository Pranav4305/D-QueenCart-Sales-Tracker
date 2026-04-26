from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
import sys
import time

import os

app = Flask(__name__)
CORS(app)

# Database Configuration - LOCAL
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '123@',
    'database': 'sales_tracker'
}

def initialize_database():
    """Auto-creates the database and table if they don't exist."""
    try:
        conn = mysql.connector.connect(
            host=DB_CONFIG['host'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password']
        )
        cursor = conn.cursor()
        cursor.execute("CREATE DATABASE IF NOT EXISTS sales_tracker")
        cursor.execute("USE sales_tracker")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sales (
                id INT AUTO_INCREMENT PRIMARY KEY,
                transaction_id VARCHAR(50),
                category VARCHAR(100) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                quantity INT NOT NULL,
                image_data LONGTEXT,
                sale_date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Migration: Add transaction_id if it doesn't exist
        try:
            cursor.execute("ALTER TABLE sales ADD COLUMN transaction_id VARCHAR(50)")
            # Backfill existing rows with their own ID as transaction_id
            cursor.execute("UPDATE sales SET transaction_id = CAST(id AS CHAR) WHERE transaction_id IS NULL")
            print("[OK] Migrated: added transaction_id column.")
        except Error:
            pass 

        # Migration: drop product_name column if it exists from old schema
        try:
            cursor.execute("ALTER TABLE sales DROP COLUMN product_name")
            print("[OK] Migrated: removed old product_name column.")
        except Error:
            pass  # Column doesn't exist, nothing to do
        conn.commit()
        conn.close()
        print("[OK] Database 'sales_tracker' is ready!")
    except Error as e:
        print(f"[ERROR] Could not initialize database: {e}")
        sys.exit(1)

def get_db_connection():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

@app.route('/api/sales', methods=['GET'])
def get_sales():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM sales ORDER BY sale_date DESC")
        sales = cursor.fetchall()
        # Convert decimal to float for JSON compatibility
        for sale in sales:
            sale['price'] = float(sale['price'])
            sale['sale_date'] = sale['sale_date'].isoformat() if sale['sale_date'] else None
        return jsonify(sales)
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/sales', methods=['POST'])
def add_sale():
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        
        t_id = str(int(time.time() * 1000)) # Unique transaction ID based on ms

        # Check if data is a list (bulk insert)
        if isinstance(data, list):
            query = """INSERT INTO sales (transaction_id, category, price, quantity, image_data, sale_date)
                       VALUES (%s, %s, %s, %s, %s, %s)"""
            values = [
                (t_id, s['category'], s['price'], s['quantity'], s.get('image'), s.get('date'))
                for s in data
            ]
            cursor.executemany(query, values)
        else:
            # Single insert
            sale_date = data.get('date') or None
            if sale_date:
                query = """INSERT INTO sales (transaction_id, category, price, quantity, image_data, sale_date)
                           VALUES (%s, %s, %s, %s, %s, %s)"""
                values = (t_id, data['category'], data['price'], data['quantity'], data.get('image'), sale_date)
            else:
                query = """INSERT INTO sales (transaction_id, category, price, quantity, image_data)
                           VALUES (%s, %s, %s, %s, %s)"""
                values = (t_id, data['category'], data['price'], data['quantity'], data.get('image'))
            cursor.execute(query, values)
            
        conn.commit()
        return jsonify({"success": True})
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/sales/<int:sale_id>', methods=['PUT'])
def update_sale(sale_id):
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor()
        query = """UPDATE sales 
                   SET category = %s, price = %s, quantity = %s, sale_date = %s 
                   WHERE id = %s"""
        values = (
            data['category'],
            data['price'],
            data['quantity'],
            data['date'],
            sale_id
        )
        cursor.execute(query, values)
        conn.commit()
        return jsonify({"success": True})
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/sales/<int:sale_id>/image', methods=['PATCH'])
def update_sale_image(sale_id):
    data = request.json
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE sales SET image_data = %s WHERE id = %s", (data.get('image'), sale_id))
        conn.commit()
        return jsonify({"success": True})
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/sales/<int:sale_id>', methods=['DELETE'])
def delete_sale(sale_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sales WHERE id = %s", (sale_id,))
        conn.commit()
        return jsonify({"success": True})
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/transactions/<string:t_id>', methods=['DELETE'])
def delete_transaction(t_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sales WHERE transaction_id = %s", (t_id,))
        conn.commit()
        return jsonify({"success": True})
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    print("\n" + "="*50)
    print("  Sales Tracker MySQL Backend")
    print("  Running on: http://localhost:5000")
    print("="*50 + "\n")
    initialize_database()  # Auto-create DB and table on startup
    app.run(host='0.0.0.0', port=5000, debug=True)
