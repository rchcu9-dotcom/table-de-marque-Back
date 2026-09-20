import { IsString, MaxLength } from 'class-validator';

export class DefinirCommentaireOrganisateurDto {
  // Chaîne vide autorisée : efface le commentaire.
  @IsString()
  @MaxLength(2000)
  commentaire: string;
}
