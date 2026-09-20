-- dateFinFin n'est plus saisie ni lue (etape = seule source de vérité des
-- inscriptions ouvertes/fermées). Colonne rendue nullable, valeurs conservées ;
-- la suppression physique est reportée à un lot ultérieur.
ALTER TABLE `insc_editions` MODIFY `date_fin_fin` DATETIME NULL;
