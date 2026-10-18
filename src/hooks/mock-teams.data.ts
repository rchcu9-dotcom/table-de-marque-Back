export type MockTeam = {
  id: string;
  /** Nom affiché sur les pages publiques : le nom court, égal à `id`. */
  name: string;
  /** Nom officiel du club. Informatif : ne doit alimenter ni Equipe.name ni un slug. */
  nomComplet: string;
  logo: string;
};

export const MOCK_TEAMS: MockTeam[] = [
  {
    id: 'Rennes',
    name: 'Rennes',
    nomComplet: 'Rennes Cormorans Hockey Club',
    logo: 'https://drive.google.com/thumbnail?id=1meZ3zDskXqC8eYwrB6_7c-nbWKJKJUBK&sz=w600',
  },
  {
    id: 'Dammarie',
    name: 'Dammarie',
    nomComplet: 'Les Caribous de Seine et Marne',
    logo: 'https://drive.google.com/thumbnail?id=1LUl2bK26nI6exx9xBakcbM8UipEk40O8&sz=w600',
  },
  {
    id: 'St-Brieuc',
    name: 'St-Brieuc',
    nomComplet: 'Les Korrigans de Saint Brieuc',
    logo: 'https://drive.google.com/thumbnail?id=1B98HLQ_pKHW2GSuZY30LOv0UJjiIprfA&sz=w600',
  },
  {
    id: 'Anglet',
    name: 'Anglet',
    nomComplet: "Hormadi d'Anglet",
    logo: 'https://drive.google.com/thumbnail?id=1losYcZomF-r9l6w5cdxLQI8sBkh3z-Ir&sz=w600',
  },
  {
    id: 'Evry-Viry',
    name: 'Evry-Viry',
    nomComplet: 'Evry/Viry',
    logo: 'https://drive.google.com/thumbnail?id=1GDRwBC0Gir0nrySGEfmLRh3QM1CvM5mo&sz=w600',
  },
  {
    id: 'Le-Havre',
    name: 'Le-Havre',
    nomComplet: 'Les BullDocks du Havre',
    logo: 'https://drive.google.com/thumbnail?id=1aXKN-s5iH4dC-61Pv6Z3R6QiVqUSLkTt&sz=w600',
  },
  {
    id: 'Angers',
    name: 'Angers',
    nomComplet: 'Les Ducs d’Angers',
    logo: 'https://drive.google.com/thumbnail?id=1sE1W4rjWCRCar5zTZCBru02K5dl9aC3j&sz=w600',
  },
  {
    id: 'Rouen',
    name: 'Rouen',
    nomComplet: 'Les Dragons de Rouen',
    logo: 'https://drive.google.com/thumbnail?id=1b_cFEZ3Ku643ErESrSsEbQUMVO74Pnft&sz=w600',
  },
  {
    id: 'Brest',
    name: 'Brest',
    nomComplet: 'Les Albatros de Brest',
    logo: 'https://drive.google.com/thumbnail?id=1VkujdhqsxWKIx2rLD_OnkiM9sJX1RRi_&sz=w600',
  },
  {
    id: 'Nantes',
    name: 'Nantes',
    nomComplet: 'Les Corsaires de Nantes',
    logo: 'https://drive.google.com/thumbnail?id=1B49dkM_ly9ZBQOkMzAdRMvIIPAjRRPui&sz=w600',
  },
  {
    id: 'Meudon',
    name: 'Meudon',
    nomComplet: 'Les Comètes de Meudon',
    logo: 'https://drive.google.com/thumbnail?id=1uWeLarBTFfAXRdfpUZDXojdKi2k8GGAL&sz=w600',
  },
  {
    id: 'Tours',
    name: 'Tours',
    nomComplet: 'Les Remparts de Tours',
    logo: 'https://drive.google.com/thumbnail?id=10Vd6v6fDgU5XXKHmBOnSBYFk-0k3CkvH&sz=w600',
  },
  {
    id: 'Poitiers',
    name: 'Poitiers',
    nomComplet: 'Les Dragons de Poitiers',
    logo: 'https://drive.google.com/thumbnail?id=185Abh8xIglJzTEryEESdMhbHSud6Cbie&sz=w600',
  },
  {
    id: 'Gap',
    name: 'Gap',
    nomComplet: 'Les Rapaces de Gap',
    logo: 'https://drive.google.com/thumbnail?id=1mzwRFnS9ZYFBUw6T_xHyZIvTXNjc4s-3&sz=w600',
  },
  {
    id: 'Dunkerque',
    name: 'Dunkerque',
    nomComplet: 'Les Corsaires de Dunkerque',
    logo: 'https://drive.google.com/thumbnail?id=1Qm3e3paFYtKEztJjzg-wXY94pB82_OAv&sz=w600',
  },
  {
    id: 'Caen',
    name: 'Caen',
    nomComplet: 'Les Drakkars de Caen',
    logo: 'https://storage.googleapis.com/glide-prod.appspot.com/uploads-v2/k3tG7yB2PTnnUxlYcpPZ/pub/bG0Yt8yAyo1Yfh05bO3g.png',
  },
];
