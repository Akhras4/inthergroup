from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import json
import re
import ezdxf
from datetime import datetime
from typing import List, Dict

app = Flask(__name__, static_folder='../frontend/build')
CORS(app)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['COMPONENT_DB'] = 'component_db.json'
app.config['ALLOWED_EXTENSIONS'] = {'dxf'}
app.config['COMPONENT_DB'] = os.path.join(os.path.dirname(__file__), 'component_db.json')

# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def load_component_db():
    with open(app.config['COMPONENT_DB'], 'r') as f:
        return json.load(f)

def clean_position_number(text: str, prefix: str) -> str:
    if text.startswith(prefix + "_"):
        position_part = text[len(prefix)+1:]  # Remove prefix and underscore
    else:
        position_part = text[len(prefix):]  # Just remove prefix
    
    # Extract all digits
    digits = ''.join(filter(str.isdigit, position_part))
    
    # Handle cases where we don't have enough digits
    if not digits:
        return prefix  # Return just the prefix if no numbers found
    
    if len(digits) >= 7:
        return f"{digits[:2]}.{digits[2:7]}"
    elif len(digits) >= 2:
        return f"{digits[:2]}.{digits[2:].ljust(5, '0')}"
    return f"{digits.ljust(7, '0')[:2]}.{digits.ljust(7, '0')[2:7]}"

def natural_sort_key(s: Dict) -> List:
    """Generate a natural sort key for strings containing numbers."""
    return [int(text) if text.isdigit() else text.lower() 
            for text in re.split('([0-9]+)', s["Position"])]

def parse_dxf_to_json(dxf_path: str, component_db: Dict) -> Dict:
    """Parse DXF file and return structured data"""
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()

        result = {
            "Total IO List": [],
            "IO Configuration": [],
            "timestamp": datetime.now().isoformat(),
            "source_file": os.path.basename(dxf_path)
        }

        WHITE = 7
        ORANGE = 30
        INCLUDED_COLORS = {WHITE, ORANGE, 256}  # 256 is BY_LAYER

        sequence = 1
        i_onr, q_onr = 300, 318  # I/O number counters

        for entity in msp:
            if entity.dxftype() == 'INSERT' and entity.has_attrib:
                for attr in entity.attribs:
                    try:
                        text = (attr.dxf.text or "").strip()
                        if not text:
                            continue

                        # Check if text matches any component prefix
                        prefix = None
                        if "MVK" in text:
                            prefix = "MVK-fio" if "fio" in text else "MVK-io"
                        else:
                            for p in component_db:
                                if p.startswith("MVK"):
                                    continue
                                if text.startswith(p):
                                    prefix = p
                                    break

                        if not prefix or prefix not in component_db:
                            continue

                        info = component_db[prefix]
                        position = clean_position_number(text, prefix)

                        # Format inputs and outputs
                        base_pos = ''.join(filter(str.isdigit, position.split('.')[1])) if '.' in position else position
                        inputs = []
                        outputs = []

                        for pattern in info.get("Inputs", []):
                            try:
                                inputs.append(pattern.format(
                                    full_text=text,
                                    position=base_pos,
                                    num=text.split('_')[1] if '_' in text else '1'
                                ))
                            except:
                                inputs.append(f"Error: {pattern}")

                        for pattern in info.get("Outputs", []):
                            try:
                                outputs.append(pattern.format(
                                    position=base_pos,
                                    num=text.split('_')[1] if '_' in text else '1'
                                ))
                            except:
                                outputs.append(f"Error: {pattern}")

                        # Add to Total IO List
                        io_device = {
                            "Sequence": sequence,
                            "Position": position,
                            "Component": info["Component"],
                            "Subtype": info["Subtype"],
                            "IO Device": int(info["IO_Type"]),
                            "Inputs": ", ".join(inputs),
                            "Outputs": ", ".join(outputs) if outputs else None,
                            "Total IO": len(inputs) + len(outputs),
                            "Input Cable": info.get("Input_Cable", ""),
                            "Output Cable": info.get("Output_Cable", "") if outputs else None
                        }
                        io_device = {k: v for k, v in io_device.items() if v is not None}
                        result["Total IO List"].append(io_device)

                        # Add to IO Configuration
                        for i in range(max(len(inputs), len(outputs))):
                            port = i % 8
                            if i < len(inputs):
                                result["IO Configuration"].append({
                                    "IO device": f"{'fio' if info['Subtype'] == 'fio' else 'io'}{position.replace('.', '')}",
                                    "Splitter used?": "No",
                                    "Pin number": "Pin 2",
                                    "Port number": port,
                                    "I/O name": inputs[i],
                                    "I/O": "I",
                                    "I/O Number": f"I{i_onr}.{port}",
                                    "Cable type": info.get("Input_Cable", ""),
                                    "CABLE LENGTH": ""
                                })
                            
                            if i < len(outputs):
                                result["IO Configuration"].append({
                                    "IO device": f"{'fio' if info['Subtype'] == 'fio' else 'io'}{position.replace('.', '')}",
                                    "Splitter used?": "No",
                                    "Pin number": "Pin 4",
                                    "Port number": None,
                                    "I/O name": outputs[i],
                                    "I/O": "Q",
                                    "I/O Number": f"Q{q_onr}.{port}",
                                    "Cable type": info.get("Output_Cable", ""),
                                    "CABLE LENGTH": ""
                                })

                            if port == 7:
                                i_onr += 1
                                q_onr += 1

                        sequence += 1

                    except Exception as e:
                        print(f"Skipping attribute: {e}")
                        continue

        result["Total IO List"] = sorted(result["Total IO List"], key=natural_sort_key)
        return result

    except Exception as e:
        print(f"Error processing DXF: {e}")
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
            "source_file": os.path.basename(dxf_path)
        }

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload and processing"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            component_db = load_component_db()
            result = parse_dxf_to_json(filepath, component_db)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            # Clean up uploaded file
            if os.path.exists(filepath):
                os.remove(filepath)
    
    return jsonify({"error": "Invalid file type"}), 400



@app.route('/component_db', methods=['GET'])
def get_component_db():
    """Return the component database"""
    try:
        return jsonify(load_component_db())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Serve React frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True)