// نسبة مطابقة بسيطة بين وظيفة ومتقدم عليها — 5 معايير بأوزان مختلفة (من 100%)، بترجع النسبة
// من غير أي "صندوق أسود": تخصص 30%، سنوات خبرة جوه النطاق 25%، مستوى الوظيفة 20%، تقاطع
// الكلمات المفتاحية 15% (نسبي مش binary)، محافظة 10%.
//
// لو أي معيار مش متاح (طرف من الاتنين معندوش قيمة له خالص — زي وظيفة من غير minExperience/
// maxExperience محددين، أو تقديم قديم من قبل ما jobLevel/keywords يتضافوا لـseekerSnapshot)،
// بيتستبعد تمامًا من الحساب (مش بيتحسب صفر) والنسبة بتتحسب من وزن المعايير المتاحة بس —
// عشان وظيفة من غير نطاق خبرة محدد متحطش سقف مصطنع على كل المتقدمين. لو مفيش أي معيار متاح
// خالص، بترجع null (الواجهة تخفي الشارة بدل ما تعرض رقم مضلل).

export type MatchJob = {
  specialization?: string;
  jobLevel?: string;
  minExperience?: number | null;
  maxExperience?: number | null;
  keywords?: string[];
  governorate?: string;
};

export type MatchSeeker = {
  specialization?: string;
  jobLevel?: string;
  yearsOfExperience?: number;
  keywords?: string[];
  governorate?: string;
};

const WEIGHTS = {
  specialization: 30,
  experience: 25,
  jobLevel: 20,
  keywords: 15,
  governorate: 10,
};

export function calculateMatchPercent(job: MatchJob, seeker: MatchSeeker): number | null {
  let earnedWeight = 0;
  let totalWeight = 0;

  if (job.specialization && seeker.specialization) {
    totalWeight += WEIGHTS.specialization;
    if (job.specialization === seeker.specialization) earnedWeight += WEIGHTS.specialization;
  }

  if (job.minExperience != null || job.maxExperience != null) {
    if (typeof seeker.yearsOfExperience === "number") {
      totalWeight += WEIGHTS.experience;
      const aboveMin = job.minExperience == null || seeker.yearsOfExperience >= job.minExperience;
      const belowMax = job.maxExperience == null || seeker.yearsOfExperience <= job.maxExperience;
      if (aboveMin && belowMax) earnedWeight += WEIGHTS.experience;
    }
  }

  if (job.jobLevel && seeker.jobLevel) {
    totalWeight += WEIGHTS.jobLevel;
    if (job.jobLevel === seeker.jobLevel) earnedWeight += WEIGHTS.jobLevel;
  }

  if (Array.isArray(job.keywords) && job.keywords.length > 0 && Array.isArray(seeker.keywords) && seeker.keywords.length > 0) {
    totalWeight += WEIGHTS.keywords;
    const overlap = job.keywords.filter((k) => seeker.keywords!.includes(k)).length;
    earnedWeight += WEIGHTS.keywords * (overlap / job.keywords.length);
  }

  if (job.governorate && seeker.governorate) {
    totalWeight += WEIGHTS.governorate;
    if (job.governorate === seeker.governorate) earnedWeight += WEIGHTS.governorate;
  }

  if (totalWeight === 0) return null;
  return Math.round((earnedWeight / totalWeight) * 100);
}
