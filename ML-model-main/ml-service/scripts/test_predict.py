"""
Local smoke-test script for the Python model only.

This file is not used by the Node.js backend or the FastAPI /analyze endpoint.
The backend sends real extracted contract text to app.main -> /analyze at runtime.
"""

from app.predictor import analyze_text

sample_text = """
Player Promotion and Brand Endorsement Agreement dated 01/06/2026 between Apex Cricket Ventures Pvt Ltd and Shubham Gill. The company agrees to pay Rs 1800000 to the player for 10 months...

The company may terminate the agreement immediately without notice...

A penalty of 15% of the contract amount...

All campaign strategies, payment details, and commercial terms shall remain confidential.

Any dispute shall be referred to arbitration in New Delhi and governed by Indian law.
"""

result = analyze_text(sample_text)

# print("\nENTITIES")
# print("-" * 60)
# for ent in result["entities"]:
#     print(f"{ent['text']} -> {ent['label']}")

# print("\nFILTERED CLAUSES")
# print("-" * 60)
# for i, clause in enumerate(result["clauses"], start=1):
#     print(f"\nClause {i}")
#     print("Short Text :", clause["clause_text"])
#     print("Type       :", clause["clause_type"])
#     print("Risk       :", clause["risk_label"])

# print("\nSUMMARY")
# print("-" * 60)
# print(result["summary"])
print(result)
