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
    """Enhanced position cleaner for Siemens-style codes"""
    # Handle patterns like =Z01+01055-200U0
    if text.startswith('=Z'):
        try:
            # Extract the position part (01055 from =Z01+01055-200U0)
            position_part = text.split('+')[1].split('-')[0]
            # Format as XX.XXXXX (01.05500 from 01055)
            return f"{position_part[:2]}.{position_part[2:].ljust(5,'0')}"
        except:
            return text  # fallback to original text if parsing fails
    
    # Original logic for other cases
    if text.startswith(prefix + "_"):
        position_part = text[len(prefix)+1:]
    else:
        position_part = text[len(prefix):]
    
    digits = ''.join(filter(str.isdigit, position_part))
    if not digits:
        return prefix
    
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
    """Parse DXF file and return structured data, with detailed component logging"""
    ALLOWED_LAYERS = {'0_SA-Comp_Profinet', '0_SA-Comp_Safety'}
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()

        result = {
            "Total IO List": [],
            "IO Configuration": [],
            "timestamp": datetime.now().isoformat(),
            "source_file": os.path.basename(dxf_path)
        }

        # Print header for component layout
        print("\nALL COMPONENTS IN DXF FILE:")
        print("-" * 120)
        print(f"{'Layer':<25} | {'Block':<15} | {'Text':<20} | {'Position':<12} | {'Component':<20} | {'Type':<10} | {'Inputs':<8} | {'Outputs':<8}")
        print("-" * 120)

        sequence = 1
        i_onr, q_onr = 300, 318
        total_entities = 0
        matched_components = 0


        for entity in msp:
            if entity.dxftype() != 'INSERT':
                continue

            total_entities += 1
            layer = entity.dxf.layer
            if layer =="0_SA-Comp_ICE":
                continue
            block = entity.dxf.name
            has_attribs = hasattr(entity, 'attribs')  # Fix for attribute check

            # Default values for logging
            log_text = '-'
            log_position = '-'
            log_component = '-'
            log_type = '-'
            log_inputs = '-'
            log_outputs = '-'

            if has_attribs:
                for attr in entity.attribs:
                    try:
                        text = (attr.dxf.text or "").strip()
                        if not text:
                            continue

                        log_text = text if len(text) <= 20 else text[:17] + "..."

                        # Check for component match
                        prefix = None
                        text_clean = text.replace('=', '').replace('+', '')  # Clean special chars
                        for p in component_db:
                            # Case 1: Standard prefix match
                            if text.startswith(p):
                                prefix = p
                                break
                            # Case 2: Siemens-style code match
                            elif text.startswith('=Z') and p in text_clean:
                                prefix = p
                                break

                        if prefix:
                            info = component_db[prefix]
                            position = clean_position_number(text, prefix)
                            
                            # Format inputs/outputs
                            inputs = []
                            outputs = []
                            
                            for pattern in info.get("Inputs", []):
                                try:
                                    inputs.append(pattern.format(
                                        full_text=text,
                                        position=position.split('.')[1] if '.' in position else position,
                                        num=text.split('_')[1] if '_' in text else '1'
                                    ))
                                except:
                                    inputs.append(f"Error: {pattern}")

                            for pattern in info.get("Outputs", []):
                                try:
                                    outputs.append(pattern.format(
                                        position=position.split('.')[1] if '.' in position else position,
                                        num=text.split('_')[1] if '_' in text else '1'
                                    ))
                                except:
                                    outputs.append(f"Error: {pattern}")

                            # Update logging variables
                            log_position = position
                            log_component = info["Component"]
                            log_type = info["Subtype"]
                            log_inputs = len(inputs)
                            log_outputs = len(outputs)

                            matched_components += 1

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
                        print(f"Error processing attribute in {block}: {str(e)}")
                        continue

            # Print line for EVERY entity
            print(f"{layer:<25} | {block:<15} | {log_text:<20} | {log_position:<12} | "
                  f"{log_component:<20} | {log_type:<10} | {log_inputs:^8} | {log_outputs:^8}")

        print("-" * 120)
        print(f"TOTAL INSERT ENTITIES: {total_entities}")
        print(f"MATCHED COMPONENTS: {matched_components}")
        print(f"UNMATCHED ENTITIES: {total_entities - matched_components}")
        print("-" * 120)

        result["Total IO List"] = sorted(result["Total IO List"], key=natural_sort_key)
        return result

    except Exception as e:
        print(f"DXF Processing Error: {str(e)}")
        return {
            "error": str(e),
            "timestamp": datetime.now().isoformat(),
            "source_file": os.path.basename(dxf_path)
        }



results_store = {}  # Temporary storage for results

@app.route('/api/results', methods=['GET'])
def get_results():
    """Return the last processed DXF results"""
    try:
        if not results_store:
            return jsonify({"error": "No results available"}), 404
        return jsonify(results_store)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        try:
            component_db = load_component_db()
            result = parse_dxf_to_json(filepath, component_db)
            global results_store
            results_store = result
            
            # Ensure consistent naming in response
            return jsonify({
                "success": True,
                "data": {
                    "Total_IO_List": result["Total IO List"],  # Consistent naming
                    "IO_Configuration": result["IO Configuration"],
                    "timestamp": result["timestamp"],
                    "source_file": result["source_file"]
                },
                "stats": {
                    "total_components": len(result["Total IO List"]),
                    "total_io": sum(io.get("Total IO", 0) for io in result["Total IO List"])
                }
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
    
    return jsonify({'error': 'Invalid file type'}), 400

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