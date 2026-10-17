import { SchemeItem } from '../types';

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
    officialGuidanceUrl: 'https://ataljal.mowr.gov.in/'
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
    officialGuidanceUrl: 'https://jaljeevanmission.gov.in/'
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
    officialGuidanceUrl: 'https://nrega.nic.in/'
  },
  {
    id: 'sch_amrit_sarovar',
    code: 'ASA-WB-04',
    name: 'Mission Amrit Sarovar',
    description: 'Creation and rejuvenation of at least 75 traditional water bodies (minimum 1 acre area with minimum 10,000 cu.m water storage capacity) per district to boost local storage in water-stressed priority districts.',
    primaryFocus: 'Traditional Water Body Rejuvenation & Storage Capacity',
    fundingStructure: 'Convergence of MGNREGA, XV Finance Commission & State Funds',
    eligibleTargetConditions: [
      'Existing silted or encroached traditional pond/talaab',
      'Minimum catchment area of 5 hectares',
      'High local livestock and agricultural water demand'
    ],
    maxSanctionUnitAmountInr: 3500000,
    implementingAgency: 'District Rural Development Authority (DRDA)',
    officialGuidanceUrl: 'https://amritsarovar.gov.in/'
  }
];
