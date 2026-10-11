import type { SchemeItem } from '../types.ts';

export const INTERVENTION_SCHEMES: SchemeItem[] = [
  {
    id: 'sch_atal_bhujal',
    code: 'ABY-GW-01',
    name: 'Atal Bhujal Yojana (Atal Jal)',
    description: 'Community-led groundwater management scheme focused on demand-side interventions, water budgeting, artificial recharge structures, and Gram Panchayat water security plans in over-exploited and critical blocks.',
    primaryFocus: 'Groundwater Recharge, Water Budgeting & Demand Management',
    fundingStructure: 'Central Sector Scheme (World Bank Assisted 50:50)',
    eligibleTargetConditions: [
      'Over-exploited or Critical Groundwater Block status',
      'Declining water table (>0.5 m/yr trend)',
      'Active Jal Samiti in Gram Panchayat',
      'Monsoon rainfall deficit > 15%'
    ],
    maxSanctionUnitAmountInr: 2500000,
    implementingAgency: 'Department of Water Resources, RD & GR / District Jal Samiti',
    officialGuidanceUrl: 'https://ataljal.mowr.gov.in/',
    officialSource: 'Ministry of Jal Shakti, DoWR, RD & GR (National Guidelines 2020)',
    effectiveDate: '2020-04-01',
    applicability: 'Identified water-stressed blocks across 7 participating States including MP and UP Bundelkhand',
    eligibilityCaveat: 'Requires Gram Panchayat Water Security Plan approved by District Implementation Unit; not an automatic entitlement',
    reviewOwnerRole: 'district_collector'
  },
  {
    id: 'sch_jjm',
    code: 'JJM-WS-02',
    name: 'Jal Jeevan Mission (JJM - Har Ghar Jal)',
    description: 'Provides functional household tap connections (FHTC) and sustainable drinking water source augmentation (infiltration galleries, borewell recharge structures) in water-stressed rural habitations.',
    primaryFocus: 'Drinking Water Source Sustainability & Piped Supply',
    fundingStructure: 'Centrally Sponsored Scheme (50:50 Centre:State for MP/UP)',
    eligibleTargetConditions: [
      'Habitations with tap connectivity gap > 30%',
      'Drinking water source depletion (< 10 m bgl yield failure)',
      'High seasonal tanker dependency history'
    ],
    maxSanctionUnitAmountInr: 5000000,
    implementingAgency: 'Public Health Engineering Department (PHED)',
    officialGuidanceUrl: 'https://jaljeevanmission.gov.in/',
    officialSource: 'Department of Drinking Water and Sanitation, Operational Guidelines 2019',
    effectiveDate: '2019-08-15',
    applicability: 'All rural habitations with drinking water vulnerability',
    eligibilityCaveat: 'Detailed Project Report (DPR) clearance and State Level Scheme Sanctioning Committee approval mandatory',
    reviewOwnerRole: 'district_collector'
  },
  {
    id: 'sch_mgnrega_water',
    code: 'MGNREGA-WC-03',
    name: 'MGNREGA Water Conservation Works',
    description: 'Labor-intensive natural resource management works including check dams, boulder bunds, contour trenches, farm ponds, and gully plugs to slow runoff and enhance groundwater infiltration in hard-rock terrains.',
    primaryFocus: 'Surface Runoff Harvesting & Natural Recharge Structures',
    fundingStructure: 'Centrally Sponsored (100% Labor, 75:25 Material)',
    eligibleTargetConditions: [
      'High soil erosion & steep surface slope (> 3%)',
      'Available job-card labor pool in Gram Panchayat',
      'Runoff coefficient > 0.4 on barren/fallow land'
    ],
    maxSanctionUnitAmountInr: 1500000,
    implementingAgency: 'Panchayat and Rural Development Department',
    officialGuidanceUrl: 'https://nrega.nic.in/',
    officialSource: 'Ministry of Rural Development, Natural Resource Management Works Framework',
    effectiveDate: '2006-02-02',
    applicability: 'Notified rural blocks with active Gram Panchayat labor budget',
    eligibilityCaveat: 'Gram Sabha resolution and administrative sanction by Programme Officer (BDO) required prior to commencement',
    reviewOwnerRole: 'bdo'
  },
  {
    id: 'sch_amrit_sarovar',
    code: 'ASA-WB-04',
    name: 'Mission Amrit Sarovar',
    description: 'Creation and rejuvenation of at least 75 traditional water bodies (minimum 1 acre area with minimum 10,000 cu.m water storage capacity) per district in Bundelkhand to boost local storage.',
    primaryFocus: 'Traditional Water Body Rejuvenation & Storage Capacity',
    fundingStructure: 'Convergence of MGNREGA, XV Finance Commission & State Funds',
    eligibleTargetConditions: [
      'Existing silted or encroached traditional pond/talaab',
      'Minimum catchment area of 5 hectares',
      'High local livestock and agricultural water demand'
    ],
    maxSanctionUnitAmountInr: 3500000,
    implementingAgency: 'District Rural Development Authority (DRDA)',
    officialGuidanceUrl: 'https://amritsarovar.gov.in/',
    officialSource: 'Government of India Mission Amrit Sarovar Guidelines 2022',
    effectiveDate: '2022-04-24',
    applicability: 'Target minimum 75 Amrit Sarovars per district in Bundelkhand',
    eligibilityCaveat: 'Site verification by district nodal officer and user water committee formation required',
    reviewOwnerRole: 'bdo'
  }
];
