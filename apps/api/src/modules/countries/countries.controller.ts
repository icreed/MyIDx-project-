import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CountriesService } from "./countries.service.js";

@ApiTags("countries")
@Controller({ path: "countries", version: "1" })
export class CountriesController {
  constructor(private readonly countries: CountriesService) {}

  @Get()
  list() {
    return this.countries.listEnabled();
  }

  /** Document types accepted in a country, driving the client's capture UI. */
  @Get(":code/id-types")
  idTypes(@Param("code") code: string, @Query("scope") scope: "KYC" | "KYB" = "KYC") {
    return this.countries.getIdTypes(code, scope);
  }
}
