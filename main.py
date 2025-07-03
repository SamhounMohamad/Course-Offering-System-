# main.py (Ensure this is the name of your Flask app file in Replit)
import pandas as pd
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os # Import the os module

app = Flask(__name__)
CORS(app)

last_eligible_students_data = pd.DataFrame()

# Define the exact filename
EXCEL_FILE_NAME = "data.xlsx"

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/check_eligibility', methods=['POST'])
def check_eligibility():
    """
    API endpoint to check student eligibility based on target course and prerequisites.
    """
    global last_eligible_students_data

    data = request.get_json()
    target_course = data.get('target_course', '').strip().upper()
    prereqs_input = data.get('prerequisites', '').strip().upper()

    prereqs = [p.strip() for p in prereqs_input.split(",") if p]

    if not target_course:
        return jsonify({"success": False, "message": "Target Course is required."}), 400

    try:
        # --- Diagnostic Check ---
        if not os.path.exists(EXCEL_FILE_NAME):
            # If os.path.exists also fails, it confirms the file is not found by Python
            return jsonify({
                "success": False,
                "message": f"Error: '{EXCEL_FILE_NAME}' not found by os.path.exists(). Please ensure it's in the root directory and the name is exact."
            }), 500
        # --- End Diagnostic Check ---

        df = pd.read_excel(EXCEL_FILE_NAME)

        df.columns = df.columns.str.strip().str.upper()
        df['COURSE'] = df['COURSE'].astype(str).str.strip().str.upper()
        df['GRADE'] = df['GRADE'].astype(str).str.strip().str.upper()

        expected_cols = ['ID', 'COURSE', 'GRADE', 'FIRST NAME', 'FATHER NAME', 'LAST NAME']
        if not all(col in df.columns for col in expected_cols):
            missing_cols = [col for col in expected_cols if col not in df.columns]
            return jsonify({"success": False, "message": f"Missing required columns in '{EXCEL_FILE_NAME}': {', '.join(missing_cols)}. Expected: {', '.join(expected_cols)}"}), 400

        passing_grades = ["A", "B", "C", "IP"]

        passed_sets = []
        if prereqs:
            for prereq in prereqs:
                passed_ids = df[(df["COURSE"] == prereq) & (df["GRADE"].isin(passing_grades))]["ID"].unique()
                passed_sets.append(set(passed_ids))
            passed_all = set.intersection(*passed_sets)
        else:
            passed_all = set(df["ID"].unique())

        took_target = set(df[df["COURSE"] == target_course]["ID"].unique())

        eligible_ids = sorted(list(passed_all - took_target))

        student_info = df[df['ID'].isin(eligible_ids)][['ID', 'FIRST NAME', 'FATHER NAME', 'LAST NAME']].drop_duplicates()
        last_eligible_students_data = student_info.copy()

        formatted_students = []
        if not student_info.empty:
            for i, (_, row) in enumerate(student_info.iterrows(), start=1):
                full_name = f"{row['FIRST NAME']} {row['FATHER NAME']} {row['LAST NAME']}"
                student_id = str(row['ID']).split('.')[0]
                formatted_students.append({
                    "number": i,
                    "id": student_id,
                    "full_name": full_name
                })
            message = f"Found {len(eligible_ids)} eligible students."
        else:
            message = "No eligible students found."

        return jsonify({
            "success": True,
            "eligible_students": formatted_students,
            "message": message
        })

    except pd.errors.EmptyDataError:
        return jsonify({"success": False, "message": f"Error: '{EXCEL_FILE_NAME}' is empty or has no valid data."}), 500
    except KeyError as e:
        return jsonify({"success": False, "message": f"Missing expected column in '{EXCEL_FILE_NAME}': {e}. Please check your Excel file headers."}), 500
    except Exception as e:
        # Catch any other unexpected errors during data processing
        return jsonify({"success": False, "message": f"An unexpected server error occurred: {e}"}), 500

@app.route('/export_current_list', methods=['GET'])
def export_current_list():
    """
    API endpoint to prepare CSV data for client-side download.
    """
    global last_eligible_students_data
    if last_eligible_students_data.empty:
        return jsonify({"success": False, "message": "No data to export. Run an eligibility check first."}), 404

    csv_data = last_eligible_students_data.to_csv(index=False)
    return csv_data, 200, {'Content-Type': 'text/csv'}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
