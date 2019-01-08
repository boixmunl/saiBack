package com.sai.saiBack;

import com.sai.saiBack.cell.Quote;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
@EnableScheduling
public class SaiBackApplication {

	private static final Logger log = LoggerFactory.getLogger(SaiBackApplication.class);

	public static void main(String[] args) {
		SpringApplication.run(SaiBackApplication.class, args);
	}


	@Bean
	public RestTemplate restTemplate(RestTemplateBuilder builder) {
		return builder.build();
	}

	@Bean
	public CommandLineRunner run(RestTemplate restTemplate) throws Exception {
		return args -> {
			Quote quote = restTemplate.getForObject(
					"http://gturnquist-quoters.cfapps.io/api/random", Quote.class);
			log.info(quote.toString());
		};
	}

	//Cada 60 segundos se lanza la lectura de las celulas
	@Scheduled(fixedRate = 60000)
	public void scheduleFixedRateTask() {
		System.out.println(
				"Fixed rate task - " + System.currentTimeMillis() / 1000);
	}
}

