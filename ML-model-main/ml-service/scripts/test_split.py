from app.utils import split_into_clauses

sample_text = """
1. Payment
The sponsor shall pay Rs 500000 to the player within 30 days. Payment shall be made in two installments.

2. Termination
The sponsor may terminate immediately without notice if the player fails to attend two promotional events.

3. Dispute Resolution
Any dispute arising from this agreement shall be resolved by arbitration in Mumbai.

4. Confidentiality
The player shall not disclose confidential business information to third parties.
"""

clauses = split_into_clauses(sample_text)

for i, clause in enumerate(clauses, start=1):
    print(f"\nClause {i}:")
    print(clause)