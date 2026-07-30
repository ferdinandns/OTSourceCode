import pdfplumber
import re
import json
import sys
from datetime import datetime

def clean_date_string(date_str):
    months_id = {'Mei': 'May', 'Agu': 'Aug', 'Okt': 'Oct', 'Des': 'Dec'}
    for id_mon, en_mon in months_id.items():
        date_str = date_str.replace(id_mon, en_mon)
    return date_str

def extract_detailed_pwo(file_path):
    results_dict = {}
    global_schedule_date = "1970-01-01"
    
    last_pwo = "Unknown"
    last_asset = "Unknown"
    last_desc = "No Description"
    last_area = "Unknown"

    with pdfplumber.open(file_path) as pdf:
        first_page_text = pdf.pages[0].extract_text(x_tolerance=3)
        date_match = re.search(r'Target.*?/\s*(\d{1,2}\s*[A-Za-z]{3}\s*\d{4})', first_page_text)
        if date_match:
            try:
                raw_date = clean_date_string(date_match.group(1))
                global_schedule_date = datetime.strptime(raw_date, "%d %b %Y").strftime("%Y-%m-%d")
            except: pass

        for i, page in enumerate(pdf.pages):
            text = page.extract_text(x_tolerance=3)
            if not text: continue

            pwo_match = re.search(r'PWO\s*[-:\s]*(\d+)', text, re.I)
            if pwo_match: 
                last_pwo = pwo_match.group(0).strip() # Keeps 'PWO-334234' clean

            desc_regex = r'Description\s*[:\s]+(.*?)(?=Asset\s*Number|WR/WO\s*Start|Asset\s*Area|Activity|$)'
            desc_match = re.search(desc_regex, text, re.I | re.S)
            if desc_match:
                found_desc = desc_match.group(1).strip()
                if found_desc and len(found_desc) > 1: last_desc = found_desc

            asset_regex = r'Asset\s*Number\s*[:\s]*(CKR-[0-9\-]+)'
            asset_match = re.search(asset_regex, text, re.I)
            if asset_match: last_asset = asset_match.group(1).strip().rstrip('-')

            area_regex = r'Asset\s*Area\s*[:\s]+([A-Z0-9]+)'
            area_match = re.search(area_regex, text, re.I)
            if area_match:
                found_area = area_match.group(1).strip()
                if found_area.upper() not in ["ACTIVITY", "TYPE"]: last_area = found_area
                else: last_area = "Unknown"

            table_settings = {"vertical_strategy": "lines", "horizontal_strategy": "lines", "snap_tolerance": 4, "join_tolerance": 4}
            table_finder = page.find_table(table_settings=table_settings)
            operations = []

            if table_finder:
                words = page.extract_words(x_tolerance=2, y_tolerance=2)
                for row in table_finder.rows:
                    cells = row.cells
                    if len(cells) < 2: continue
                    
                    if cells[0]:
                        x0, y0, x1, y1 = cells[0]
                        step_id = "".join([w['text'] for w in words if x0 <= w['x0'] <= x1 and y0 <= w['top'] <= y1]).strip()
                    else: step_id = ""
                    
                    if cells[1]:
                        x0, y0, x1, y1 = cells[1]
                        task_text = " ".join([w['text'] for w in words if x0 <= w['x0'] <= x1 and y0 <= w['top'] <= y1]).strip()
                    else: task_text = ""

                    if step_id.isdigit():
                        operations.append({
                            "Step": step_id, "Task": task_text, "Technician": "", 
                            "start_time": "", "end_time": "", "note": ""
                        })

            if operations:
                if last_pwo in results_dict:
                    results_dict[last_pwo]['Operations'].extend(operations)
                else:
                    results_dict[last_pwo] = {
                        "PWO_Number": last_pwo, "Asset_Number": last_asset, "Schedule_Date": global_schedule_date,
                        "Description": last_desc, "Area": last_area, "Operations": operations,
                        "Source_File": file_path.split('/')[-1], "Page": i + 1
                    }

    return list(results_dict.values())

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(1)
    print(json.dumps(extract_detailed_pwo(sys.argv[1])))