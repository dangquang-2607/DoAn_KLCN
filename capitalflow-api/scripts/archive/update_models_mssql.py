import os
import glob

models_dir = r"d:\code\DoAn_KLCN\capitalflow-api\app\models"

for filepath in glob.glob(os.path.join(models_dir, "*.py")):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "dialects.postgresql" in content or "UUID(" in content:
        # Thay thế import
        content = content.replace("from sqlalchemy.dialects.postgresql import UUID", "from sqlalchemy import Uuid")
        
        # Thêm import Uuid nếu chưa có mà cần thiết
        # Nhìn chung nếu thay thế dòng trên là đủ
        
        # Thay thế type
        content = content.replace("UUID(as_uuid=True)", "Uuid")
        
        # Nếu có UUID mà không có (as_uuid=True), nhưng ở đây code mẫu thường dùng UUID(as_uuid=True)
        # Sửa lại nếu còn sót UUID
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {os.path.basename(filepath)}")
