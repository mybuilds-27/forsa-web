"use client";

import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { SKILL_OPTIONS, LANGUAGE_OPTIONS, SKILL_LEVELS, LANGUAGE_LEVELS } from "@/lib/constants";
import { SkillEntry, normalizeEntries } from "@/lib/profileFields";
import SkillLevelPicker from "../SkillLevelPicker";
import FileUploadButton from "@/components/FileUploadButton";
import { h3Style, descStyle, labelStyle, inputStyle, saveBtnStyle, savedMsgStyle } from "./sharedStyles";

type Props = {
  initialData: any;
  onSaved: (partial: any) => void;
  isNewProfile?: boolean;
};

export default function SkillsAndCVTab({ initialData, onSaved, isNewProfile }: Props) {
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [languages, setLanguages] = useState<SkillEntry[]>([]);
  const [bio, setBio] = useState("");
  const [cvLink, setCvLink] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvStatus, setCvStatus] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSkills(normalizeEntries(initialData.skills));
    setLanguages(normalizeEntries(initialData.languages));
    setBio(initialData.bio || "");
    setCvLink(initialData.cvFileURL || "");
  }, [initialData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    setSaved(false);

    const data: any = {
      skills,
      languages,
      bio,
      updatedAt: serverTimestamp(),
      ...(isNewProfile ? { consentToShare: true } : {}),
    };

    if (cvLink.trim()) data.cvFileURL = cvLink.trim();

    if (cvFile) {
      if (cvFile.size > 5 * 1024 * 1024) {
        alert("حجم الملف أكبر من 5 ميجا — قلّل حجم الملف أو استخدم رابط بدلاً من الرفع المباشر.");
        setSaving(false);
        return;
      }
      try {
        setCvStatus("جاري رفع الملف...");
        const fileRef = ref(storage, `cvs/${user.uid}/${cvFile.name}`);
        await uploadBytes(fileRef, cvFile);
        data.cvFileURL = await getDownloadURL(fileRef);
        setCvStatus("تم رفع الملف ✓");
      } catch (err) {
        console.error("CV upload failed", err);
        setCvStatus("حصلت مشكلة في رفع الملف — اتحفظت باقي البيانات من غيره");
      }
    }

    await setDoc(doc(db, "job_seekers", user.uid), data, { merge: true });

    setSaving(false);
    setSaved(true);
    onSaved(data);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={h3Style}>🛠️ المهارات واللغات والسيرة الذاتية</h3>
      <p style={descStyle}>كل ده اختياري، بس بيزوّد فرصك قدام أصحاب الأعمال.</p>

      <SkillLevelPicker label="المهارات" options={SKILL_OPTIONS} levels={SKILL_LEVELS} value={skills} onChange={setSkills} />
      <SkillLevelPicker label="اللغات" options={LANGUAGE_OPTIONS} levels={LANGUAGE_LEVELS} value={languages} onChange={setLanguages} />

      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>نبذة مختصرة عن نفسك</label>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="أهم إنجازاتك، نقاط قوتك..." style={{ ...inputStyle, minHeight: 80 }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>السيرة الذاتية (CV)</label>
        <FileUploadButton
          label="📎 اختيار ملف"
          accept="application/pdf"
          fileName={cvFile?.name || (cvLink ? "✓ ملف محفوظ بالفعل" : undefined)}
          onChange={setCvFile}
        />
        <div style={{ fontSize: 12.5, color: "#4A5568", marginTop: 6 }}>
          {cvStatus || "ارفع ملف PDF (حد أقصى 5 ميجا). لو رفعت ملف، هيتجاهل الرابط تحت لو موجود."}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>أو رابط السيرة الذاتية</label>
        <input type="url" value={cvLink} onChange={(e) => setCvLink(e.target.value)} placeholder="رابط من Google Drive أو Dropbox" style={inputStyle} />
      </div>

      <button type="submit" disabled={saving} style={saveBtnStyle}>
        {saving ? "جاري الحفظ..." : "حفظ المهارات والسيرة الذاتية"}
      </button>
      {saved && <div style={savedMsgStyle}>✓ اتحفظت البيانات</div>}
    </form>
  );
}
