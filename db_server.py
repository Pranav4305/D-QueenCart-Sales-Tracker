from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

DATABASE_URL = os.environ.get('POSTGRES_URL') or os.environ.get('DATABASE_URL', 'postgresql://user:password@localhost:5432/sales_tracker')

_db_initialized = False

def initialize_database():
    global _db_initialized
    if _db_initialized:
        return
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                category VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                quantity INT NOT NULL DEFAULT 1,
                image_data TEXT,
                sale_date DATE DEFAULT CURRENT_DATE,
                transaction_id VARCHAR(50)
            )
        """)
        conn.commit()
        try:
            cursor.execute("ALTER TABLE sales ADD COLUMN transaction_id VARCHAR(50)")
            cursor.execute("UPDATE sales SET transaction_id = CAST(id AS VARCHAR) WHERE transaction_id IS NULL")
            conn.commit()
        except Exception:
            conn.rollback()
        conn.close()
        _db_initialized = True
        print("[OK] Database is ready!")
    except Exception as e:
        print(f"[ERROR] Could not initialize database: {e}")
        raise e

def get_db_connection():
    try:
        return psycopg2.connect(DATABASE_URL)
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        return None

VALID_CATEGORIES = [
    'Necklaces', 'Earrings', 'Studs', 'Rings', 'Hair Accessories',
    'Bracelets', 'Scrunchies', 'Centre Clip', 'Clutch',
    'Aligator Clip', 'TikTok Pin', 'Hair Bands', 'Nails'
]

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/sales', methods=['GET'])
def get_sales():
    try:
        initialize_database()
    except Exception as e:
        return jsonify({"error": f"Init failed: {str(e)}"}), 500

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM sales ORDER BY sale_date DESC")
        sales = cursor.fetchall()
        for sale in sales:
            sale['price'] = float(sale['price'])
            if sale['sale_date']:
                sale['sale_date'] = sale['sale_date'].isoformat()
        return jsonify(sales)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@app.route('/api/sales', methods=['POST'])
def add_sale():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    try:
        cursor = conn.cursor()
        t_id = str(uuid.uuid4())
        items = data if isinstance(data, list) else [data]

        for s in items:
            category = s.get('category', '')
            price = float(s.get('price', 0))
            quantity = int(s.get('quantity', 1))

            if category not in VALID_CATEGORIES:
                return jsonify({"error": f"Invalid category: {category}"}), 400
            if price <= 0:
                return jsonify({"error": "Price must be greater than 0"}), 400
            if quantity < 1:
                return jsonify({"error": "Quantity must be at least 1"}), 400

            sale_date = s.get('date') or None
            cursor.execute(
                "INSERT INTO sales (transaction_id, category, price, quantity, image_data, sale_date) VALUES (%s, %s, %s, %s, %s, %s)",
                (t_id, category, price, quantity, s.get('image'), sale_date)
            )

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
        cursor.execute(
            "UPDATE sales SET category = %s, price = %s, quantity = %s, sale_date = %s WHERE id = %s",
            (data['category'], data['price'], data['quantity'], data['date'], sale_id)
        )
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
