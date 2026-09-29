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
import { MISSING_BORDER_COLOR, MissingTag, useScrollToField, type ScrollTarget } from "./missingFieldUI";

type Props = {
  initialData: any;
  onSaved: (partial: any) => void;
  isNewProfile?: boolean;
  missingKeys?: Set<string>;
  scrollTarget?: ScrollTarget;
};

export default function SkillsAndCVTab({ initialData, onSaved, isNewProfile, missingKeys, scrollTarget }: Props) {
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

  useScrollToField(scrollTarget, "skills");
  useScrollToField(scrollTarget, "languages");
  useScrollToField(scrollTarget, "bio");
  useScrollToField(scrollTarget, "cvFileURL");

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

      <div
        id="field-skills"
        style={{
          marginBottom: 14,
          ...(missingKeys?.has("skills") && { border: `1.5px solid ${MISSING_BORDER_COLOR}`, borderRadius: 8, padding: 10 }),
        }}
      >
        {missingKeys?.has("skills") && <MissingTag />}
        <SkillLevelPicker label="المهارات" options={SKILL_OPTIONS} levels={SKILL_LEVELS} value={skills} onChange={setSkills} />
      </div>
      <div
        id="field-languages"
        style={{
          marginBottom: 14,
          ...(missingKeys?.has("languages") && { border: `1.5px solid ${MISSING_BORDER_COLOR}`, borderRadius: 8, padding: 10 }),
        }}
      >
        {missingKeys?.has("languages") && <MissingTag />}
        <SkillLevelPicker label="اللغات" options={LANGUAGE_OPTIONS} levels={LANGUAGE_LEVELS} value={languages} onChange={setLanguages} />
      </div>

      <div id="field-bio" style={{ marginBottom: 14 }}>
        <label style={labelStyle}>نبذة مختصرة عن نفسك{missingKeys?.has("bio") && <MissingTag />}</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="أهم إنجازاتك، نقاط قوتك..."
          style={{ ...inputStyle, minHeight: 80, ...(missingKeys?.has("bio") && { border: `1.5px solid ${MISSING_BORDER_COLOR}` }) }}
        />
      </div>
      <div
        id="field-cvFileURL"
        style={{
          ...(missingKeys?.has("cvFileURL") && { border: `1.5px solid ${MISSING_BORDER_COLOR}`, borderRadius: 8, padding: 10 }),
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>السيرة الذاتية (CV){missingKeys?.has("cvFileURL") && <MissingTag />}</label>
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
      </div>

      <button type="submit" disabled={saving} style={saveBtnStyle}>
        {saving ? "جاري الحفظ..." : "حفظ المهارات والسيرة الذاتية"}
      </button>
      {saved && <div style={savedMsgStyle}>✓ اتحفظت البيانات</div>}
    </form>
  );
}
