import { InterventionProposal } from '../types';

export const INITIAL_INTERVENTIONS: InterventionProposal[] = [
  {
    id: 'prop_tikamgarh_01',
    title: 'Check Dam & Piezometer Network Augmentation at Kundeshwar Catchment',
    blockId: 'blk_tikamgarh_main',
    blockName: 'Tikamgarh',
    districtName: 'Tikamgarh',
    schemeId: 'sch_atal_bhujal',
    schemeName: 'Atal Bhujal Yojana (Atal Jal)',
    proposedByRole: 'bdo',
    proposedByName: 'R. K. Sharma (BDO Tikamgarh)',
    targetVillage: 'Kundeshwar & Dhonga Panchayats',
    estimatedCostInr: 2200000,
    beneficiariesCount: 4800,
    evidenceRationale: 'Deficit monsoon (-235mm rainfall anomaly) paired with CGWB well depth reaching 14.8m bgl (-0.62m/yr trend). Weathered granite aquifer shows rapid post-monsoon water table decline.',
    missingEvidenceNotes: 'Requires core-drilling lithology check to confirm fracture zone depth before final masonry foundation approval.',
    reviewOwnerRole: 'district_collector',
    reviewOwnerName: 'District Magistrate / Collector Office, Tikamgarh',
    status: 'under_review',
    createdDate: '2026-10-02',
    lastUpdatedDate: '2026-10-06',
    comments: [
      {
        authorName: 'R. K. Sharma',
        authorRole: 'bdo',
        date: '2026-10-02',
        text: 'Initial proposal drafted following Gram Sabha resolution at Kundeshwar.'
      },
      {
        authorName: 'Dr. V. P. Singh',
        authorRole: 'environmental_analyst',
        date: '2026-10-04',
        text: 'Satellite TWSA anomaly (-7.2cm) corroborates deep soil dryness. Recommended site selection alignment with Sentinel NDWI surface water map.'
      }
    ]
  },
  {
    id: 'prop_chhatarpur_02',
    title: 'Amrit Sarovar Desilting & Artificial Recharge Shaft at Rajnagar',
    blockId: 'blk_rajnagar',
    blockName: 'Rajnagar',
    districtName: 'Chhatarpur',
    schemeId: 'sch_amrit_sarovar',
    schemeName: 'Mission Amrit Sarovar',
    proposedByRole: 'jal_samiti',
    proposedByName: 'Suresh Kumar Patel (Jal Samiti Head)',
    targetVillage: 'Khajuraho Rural / Rajnagar Ward 4',
    estimatedCostInr: 3100000,
    beneficiariesCount: 6200,
    evidenceRationale: 'Sentinel-2 NDWI indicates 42% reduction in surface water area of traditional lake. Soil moisture at 0.12 m³/m³ with 15.1m bgl well depth.',
    missingEvidenceNotes: 'Hydraulic conductivity test needed for recharge shaft injection rate estimation.',
    reviewOwnerRole: 'bdo',
    reviewOwnerName: 'Block Development Office, Rajnagar',
    status: 'field_verification_requested',
    createdDate: '2026-09-29',
    lastUpdatedDate: '2026-10-05',
    comments: [
      {
        authorName: 'Suresh Kumar Patel',
        authorRole: 'jal_samiti',
        date: '2026-09-29',
        text: 'Pond desilting will restore 14,000 cu.m storage before next monsoon.'
      },
      {
        authorName: 'BDO Rajnagar',
        authorRole: 'bdo',
        date: '2026-10-05',
        text: 'Assigned Assistant Engineer for hydrogeological field survey.'
      }
    ]
  },
  {
    id: 'prop_mauranipur_03',
    title: 'Deep Infiltration Trench & Borewell Recharge Array',
    blockId: 'blk_mauranipur',
    blockName: 'Mauranipur',
    districtName: 'Jhansi',
    schemeId: 'sch_mgnrega_water',
    schemeName: 'MGNREGA Water Conservation Works',
    proposedByRole: 'gram_pradhan',
    proposedByName: 'Smt. Sunita Devi (Gram Pradhan)',
    targetVillage: 'Roni & Bangra Belt',
    estimatedCostInr: 1400000,
    beneficiariesCount: 3100,
    evidenceRationale: 'Severe stress score (75/100) driven by 15.8m bgl depth and intense agricultural extraction during Rabi wheat sowing.',
    missingEvidenceNotes: 'None. MGNREGA job-card labor pool verified.',
    reviewOwnerRole: 'bdo',
    reviewOwnerName: 'BDO Mauranipur',
    status: 'approved',
    createdDate: '2026-09-20',
    lastUpdatedDate: '2026-10-01',
    comments: [
      {
        authorName: 'Smt. Sunita Devi',
        authorRole: 'gram_pradhan',
        date: '2026-09-20',
        text: 'Panchayat approved 80 job card workers for trench digging.'
      },
      {
        authorName: 'BDO Mauranipur',
        authorRole: 'bdo',
        date: '2026-10-01',
        text: 'Sanctioned under NRM allocation.'
      }
    ]
  }
];
