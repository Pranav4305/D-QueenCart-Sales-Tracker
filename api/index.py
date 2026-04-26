from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import sys
import time
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Vercel Postgres usually provides a POSTGRES_URL environment variable
DATABASE_URL = os.environ.get('POSTGRES_URL', 'postgresql://user:password@localhost:5432/sales_tracker')

# Serve frontend
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

def initialize_database():
    """Auto-creates the table if it doesn't exist using PostgreSQL syntax."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Create table with PostgreSQL syntax
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                category VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                image_data TEXT,
                sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                transaction_id VARCHAR(50)
            )
        """)
        
        # Add transaction_id column if missing
        try:
            cursor.execute("ALTER TABLE sales ADD COLUMN transaction_id VARCHAR(50)")
            cursor.execute("UPDATE sales SET transaction_id = CAST(id AS VARCHAR) WHERE transaction_id IS NULL")
            print("[OK] Migrated: added transaction_id column.")
        except Exception:
            conn.rollback()
        
        conn.commit()
        conn.close()
        print("[OK] Database is ready!")
    except Exception as e:
        print(f"[ERROR] Could not initialize database: {e}")

def get_db_connection():
    try:
        connection = psycopg2.connect(DATABASE_URL)
        return connection
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        return None

@app.route('/api/sales', methods=['GET'])
def get_sales():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM sales ORDER BY sale_date DESC")
        sales = cursor.fetchall()
        for sale in sales:
            sale['price'] = float(sale['price'])
            sale['sale_date'] = sale['sale_date'].isoformat() if sale['sale_date'] else None
        return jsonify(sales)
    except Exception as e:
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
        t_id = str(int(time.time() * 1000))

        if isinstance(data, list):
            query = """INSERT INTO sales (transaction_id, category, price, quantity, image_data, sale_date)
                       VALUES (%s, %s, %s, %s, %s, %s)"""
            for s in data:
                sale_date = s.get('date') or None
                cursor.execute(query, (t_id, s['category'], s['price'], s['quantity'], s.get('image'), sale_date))
        else:
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
    except Exception as e:
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
        values = (data['category'], data['price'], data['quantity'], data['date'], sale_id)
        cursor.execute(query, values)
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
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
    except Exception as e:
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
    except Exception as e:
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("\n" + "="*50)
    print("  Sales Tracker - PostgreSQL Server")
    print(f"  Running on: http://localhost:{port}")
    print("="*50 + "\n")
    initialize_database()
    app.run(host='0.0.0.0', port=port, debug=False)
