#!/usr/bin/env python3
import re, csv
SRC="/private/tmp/claude-501/-Users-ziakhan-zia-personal-sportshub/665fbc39-3669-408d-84a6-2a5bc1276b6f/scratchpad/enrich_collected.md"
OUT="/Users/ziakhan/zia/personal/sportshub/docs/research/sheets/contact_enrichment.csv"

def norm(name):
    n=name.lower()
    n=re.sub(r"\(.*?\)","",n); n=re.sub(r"[^a-z0-9 ]"," ",n)
    n=re.sub(r"\b(the|of|basketball|academy|prep|elite|club|association|ba|bc|sports|group|inc)\b"," ",n)
    return re.sub(r"\s+"," ",n).strip()

rows=[]
for line in open(SRC):
    if not line.startswith("| ") or line.startswith("| Club") or line.startswith("|---"): continue
    c=[x.strip() for x in line.strip().strip("|").split("|")]
    if len(c)<7: continue
    club,city,web,email,phone,leader,social=c[:7]
    rows.append(dict(club=club,city=city,website=web,email=email,phone=phone,leader=leader,social=social))

def score(r):
    s=0
    if "@" in r["email"]: s+=4
    if re.search(r"\d{3}",r["phone"]): s+=2
    if r["website"] not in ("—","",) and "UNRESOLVED" not in r["website"]: s+=1
    if r["leader"] not in ("—","",): s+=1
    return s

best={}
for r in rows:
    k=norm(r["club"])
    if not k: continue
    if k not in best or score(r)>score(best[k]): best[k]=r

clean=sorted(best.values(), key=lambda r:r["club"].lower())
def clean_cell(v): return "" if v.strip() in ("—","(form)","(portal)","(RAMP portal)","(board form)","(coachiq portal)") else v.strip()
with open(OUT,"w",newline="") as f:
    w=csv.writer(f); w.writerow(["club","city","website","email","phone","leader","social"])
    for r in clean:
        w.writerow([r["club"],clean_cell(r["city"]),clean_cell(r["website"]),clean_cell(r["email"]),
                    clean_cell(r["phone"]),clean_cell(r["leader"]),clean_cell(r["social"])])

has_email=sum(1 for r in clean if "@" in r["email"])
has_phone=sum(1 for r in clean if re.search(r"\d{3}.\d{3}.\d{4}",r["phone"]))
unresolved=[r["club"] for r in clean if "UNRESOLVED" in r["club"]+r["city"] or "NON-MATCH" in r["city"]]
print(f"unique enriched clubs: {len(clean)}")
print(f"now have email: {has_email}")
print(f"now have phone: {has_phone}")
print(f"reachable (email or phone): {sum(1 for r in clean if '@' in r['email'] or re.search(chr(92)+'d{3}.'+chr(92)+'d{3}.'+chr(92)+'d{4}',r['phone']))}")
print(f"still unresolved: {unresolved}")
